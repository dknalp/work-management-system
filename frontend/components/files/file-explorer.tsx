"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  Trash2Icon,
  ExternalLinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  MoveIcon,
  XIcon,
  CopyIcon,
  ScissorsIcon,
  ClipboardPasteIcon,
} from "lucide-react"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FileItem, SearchResult, moveToTrash, moveItem, renameItem, copyItem } from "@/lib/actions/files"
import { cn } from "@/lib/utils"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { FileGrid } from "./file-grid"
import { FilePreviewPanel } from "./file-preview-panel"
import { SelectionLasso } from "./selection-lasso"
import { SearchResultsView } from "./search-results-view"
import { getFileIcon, formatSize } from "./file-utils"
import { usePinnedFolders } from "@/hooks/use-pinned-folders"
import { toast } from "sonner"

interface FileExplorerProps {
  items: FileItem[]
  currentPath: string
  viewMode: "grid" | "list"
  showPreview: boolean
  onTogglePreview: () => void
  searchQuery: string
  searchResults?: SearchResult[] | null
  isSearching?: boolean
  onClearSearch?: () => void
}

type Clipboard = { paths: string[]; mode: "copy" | "cut" } | null

function getFileOpenUrl(item: FileItem): string {
  if (item.source === "drive" && item.driveFileId) {
    return `https://drive.google.com/file/d/${item.driveFileId}/view`
  }
  return `/api/files/raw?path=${encodeURIComponent(item.path)}`
}

function getFileDownloadUrl(item: FileItem): string {
  if (item.source === "drive" && item.driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${item.driveFileId}`
  }
  return `/api/files/raw?path=${encodeURIComponent(item.path)}`
}

function downloadFile(item: FileItem) {
  if (item.source === "drive" && item.driveFileId) {
    window.open(getFileDownloadUrl(item), "_blank")
    return
  }
  const a = document.createElement("a")
  a.href = getFileDownloadUrl(item)
  a.download = item.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function FileExplorer({
  items,
  currentPath,
  viewMode,
  showPreview,
  searchQuery,
  searchResults,
  isSearching,
}: FileExplorerProps) {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { pin, isPinned } = usePinnedFolders()
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set())
  const [activeItem, setActiveItem] = React.useState<FileItem | null>(null)

  // Clipboard state (in-app copy/cut)
  const [clipboard, setClipboard] = React.useState<Clipboard>(null)

  // Rename modal
  const [renameOpen, setRenameOpen] = React.useState(false)
  const [renameTarget, setRenameTarget] = React.useState<FileItem | null>(null)
  const [renameValue, setRenameValue] = React.useState("")

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePaths, setDeletePaths] = React.useState<string[]>([])

  // Move-to dialog
  const [moveToOpen, setMoveToOpen] = React.useState(false)
  const [moveSourcePaths, setMoveSourcePaths] = React.useState<string[]>([])
  const [moveToTarget, setMoveToTarget] = React.useState("")

  // Sort (persisted to localStorage)
  const [sortKey, setSortKey] = useLocalStorage<"name" | "size" | "updatedAt">(
    "wms:files:sortKey",
    "name"
  )
  const [sortDir, setSortDir] = useLocalStorage<"asc" | "desc">("wms:files:sortDir", "asc")

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.isDirectory) {
      router.push(`/files/${item.path}`)
    } else {
      window.open(getFileOpenUrl(item), "_blank")
    }
  }

  const handleRename = (item: FileItem) => {
    setRenameTarget(item)
    setRenameValue(item.name)
    setRenameOpen(true)
  }

  const doRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    const res = await renameItem(renameTarget.path, renameValue.trim())
    if (res.success) {
      toast.success("Renamed successfully")
      setRenameOpen(false)
      router.refresh()
    } else {
      toast.error("Rename failed")
    }
  }

  const handleDeleteConfirm = (paths: string | string[]) => {
    setDeletePaths(typeof paths === "string" ? [paths] : paths)
    setDeleteOpen(true)
  }

  const doDelete = async () => {
    setDeleteOpen(false)
    const results = await Promise.all(deletePaths.map((p) => moveToTrash(p)))
    const succeeded = results.filter((r) => r.success)
    const failCount = results.length - succeeded.length

    if (succeeded.length > 0) {
      router.refresh()
      setSelectedPaths(new Set())
      setActiveItem(null)

      toast.success(
        succeeded.length === 1
          ? `"${succeeded[0].originalName}" çöp kutusuna taşındı`
          : `${succeeded.length} öğe çöp kutusuna taşındı`,
        {
          duration: 6000,
          action: {
            label: "Geri Al",
            onClick: async () => {
              const undoResults = await Promise.all(
                succeeded.map((r) =>
                  r.success
                    ? import("@/lib/actions/files").then(({ restoreFromTrash }) =>
                        restoreFromTrash(r.trashName, r.originalName)
                      )
                    : Promise.resolve({ success: false })
                )
              )
              const undone = undoResults.filter((r) => r.success).length
              if (undone > 0) {
                toast.success(`${undone} öğe geri yüklendi`)
                router.refresh()
              }
            },
          },
        }
      )
    }
    if (failCount > 0) {
      toast.error(`${failCount} öğe taşınamadı`)
    }
  }

  const handleMoveToOpen = (paths: string[]) => {
    setMoveSourcePaths(paths)
    setMoveToTarget("")
    setMoveToOpen(true)
  }

  const doMoveTo = async () => {
    const results = await Promise.all(
      moveSourcePaths.map((p) => moveItem(p, moveToTarget))
    )
    const ok = results.filter((r) => r.success).length
    if (ok > 0) {
      toast.success(`${ok} item(s) moved`)
      setMoveToOpen(false)
      setSelectedPaths(new Set())
      router.refresh()
    } else {
      toast.error("Move failed")
    }
  }

  const handleBulkDownload = () => {
    items
      .filter((i) => selectedPaths.has(i.path) && !i.isDirectory)
      .forEach((item) => downloadFile(item))
  }

  const handleSort = (key: "name" | "size" | "updatedAt") => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  // Clipboard operations
  const handleCopy = React.useCallback((paths: string[]) => {
    setClipboard({ paths, mode: "copy" })
    toast.success(
      paths.length === 1 ? "1 öğe kopyalandı" : `${paths.length} öğe kopyalandı`,
      { description: "Yapıştırmak için Ctrl+V" }
    )
  }, [])

  const handleCut = React.useCallback((paths: string[]) => {
    setClipboard({ paths, mode: "cut" })
    toast.success(
      paths.length === 1 ? "1 öğe kesildi" : `${paths.length} öğe kesildi`,
      { description: "Yapıştırmak için Ctrl+V" }
    )
  }, [])

  const handlePaste = React.useCallback(async () => {
    if (!clipboard) return
    const results = await Promise.all(
      clipboard.paths.map((p) =>
        clipboard.mode === "copy"
          ? copyItem(p, currentPath)
          : moveItem(p, currentPath)
      )
    )
    const ok = results.filter((r) => r.success).length
    if (ok > 0) {
      toast.success(
        clipboard.mode === "copy"
          ? `${ok} öğe yapıştırıldı`
          : `${ok} öğe taşındı`
      )
      if (clipboard.mode === "cut") setClipboard(null)
      router.refresh()
    } else {
      toast.error("Yapıştırma başarısız")
    }
  }, [clipboard, currentPath, router])

  const handleLassoChange = React.useCallback(
    (rect: { top: number; left: number; width: number; height: number } | null) => {
      if (!rect) return
      const newSelected = new Set<string>()
      const container = containerRef.current
      if (!container) return

      container.querySelectorAll("[data-file-path]").forEach((el) => {
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const rel = {
          top: elRect.top - containerRect.top + container.scrollTop,
          left: elRect.left - containerRect.left + container.scrollLeft,
          width: elRect.width,
          height: elRect.height,
        }
        const intersects =
          rect.left < rel.left + rel.width &&
          rect.left + rect.width > rel.left &&
          rect.top < rel.top + rel.height &&
          rect.top + rect.height > rel.top

        if (intersects) {
          const path = (el as HTMLElement).dataset.filePath
          if (path) newSelected.add(path)
        }
      })

      setSelectedPaths((prev) => {
        if (prev.size === newSelected.size && Array.from(newSelected).every((p) => prev.has(p)))
          return prev
        return newSelected
      })

      if (newSelected.size > 0) {
        const firstPath = Array.from(newSelected)[0]
        const firstItem = items.find((i) => i.path === firstPath)
        if (firstItem) setActiveItem((prev) => (prev?.path === firstItem.path ? prev : firstItem))
      }
    },
    [items]
  )

  const displayItems = React.useMemo(() => {
    let filtered = searchQuery
      ? items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : [...items]

    filtered.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "size") cmp = a.size - b.size
      else cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      return sortDir === "asc" ? cmp : -cmp
    })

    if (currentPath === "") return filtered

    const parentPath = currentPath.includes("/")
      ? currentPath.split("/").slice(0, -1).join("/")
      : ""
    return [
      {
        name: "..",
        path: parentPath,
        isDirectory: true,
        size: 0,
        updatedAt: new Date().toISOString(),
      },
      ...filtered,
    ]
  }, [items, currentPath, searchQuery, sortKey, sortDir])

  const handleSelect = (item: FileItem, isMulti = false) => {
    if (item.name === "..") return
    if (isMulti) {
      const next = new Set(selectedPaths)
      if (next.has(item.path)) next.delete(item.path)
      else next.add(item.path)
      setSelectedPaths(next)
    } else {
      setSelectedPaths(new Set([item.path]))
    }
    setActiveItem(item)
  }

  // Keyboard shortcuts
  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (renameOpen || deleteOpen) return

      if (e.key === "Delete" && selectedPaths.size > 0) {
        handleDeleteConfirm(Array.from(selectedPaths))
      }
      if (e.key === "F2" && selectedPaths.size === 1 && activeItem && activeItem.name !== "..") {
        handleRename(activeItem)
      }
      if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedPaths(new Set(items.map((i) => i.path)))
        if (items.length > 0) setActiveItem(items[0])
      }
      if ((e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey) && selectedPaths.size > 0) {
        e.preventDefault()
        handleCopy(Array.from(selectedPaths))
      }
      if ((e.key === "x" || e.key === "X") && (e.ctrlKey || e.metaKey) && selectedPaths.size > 0) {
        e.preventDefault()
        handleCut(Array.from(selectedPaths))
      }
      if ((e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey) && clipboard) {
        e.preventDefault()
        handlePaste()
      }
      if (e.key === "Escape") {
        setSelectedPaths(new Set())
        setActiveItem(null)
        if (clipboard) setClipboard(null)
      }
      if (e.key === "Enter" && activeItem) {
        handleItemDoubleClick(activeItem)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedPaths, activeItem, items, renameOpen, deleteOpen, clipboard, handleCopy, handleCut, handlePaste])

  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
    if (item.name === "..") {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData("application/workos-file", item.path)
    e.dataTransfer.effectAllowed = "move"
    const ghost = document.createElement("div")
    ghost.className =
      "bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl border border-white/20"
    ghost.innerText =
      selectedPaths.size > 1 ? `Moving ${selectedPaths.size} items` : `Moving ${item.name}`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDrop = async (e: React.DragEvent, targetItem: FileItem) => {
    e.preventDefault()
    if (!targetItem.isDirectory) return
    const sourcePath = e.dataTransfer.getData("application/workos-file")
    if (!sourcePath || sourcePath === targetItem.path) return
    const itemsToMove = selectedPaths.has(sourcePath) ? Array.from(selectedPaths) : [sourcePath]
    const results = await Promise.all(itemsToMove.map((path) => moveItem(path, targetItem.path)))
    const successCount = results.filter((r) => r.success).length
    if (successCount > 0) {
      toast.success(
        `${successCount} item(s) moved to ${targetItem.name === ".." ? "parent directory" : targetItem.name}`
      )
      router.refresh()
    }
  }

  const sortIcon = (col: "name" | "size" | "updatedAt") =>
    sortKey !== col ? (
      <ChevronsUpDownIcon className="ml-1 inline size-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ChevronUpIcon className="ml-1 inline size-3" />
    ) : (
      <ChevronDownIcon className="ml-1 inline size-3" />
    )

  const folderChoices = displayItems.filter(
    (i) => i.isDirectory && i.name !== ".." && !moveSourcePaths.includes(i.path)
  )

  const isCutItem = (path: string) =>
    clipboard?.mode === "cut" && clipboard.paths.includes(path)

  return (
    <>
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 overflow-hidden select-none"
        onClick={() => {
          setSelectedPaths(new Set())
          setActiveItem(null)
        }}
      >
        <SelectionLasso containerRef={containerRef} onSelectionChange={handleLassoChange} />

        <div className="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto p-6">
          {isSearching && searchResults === null ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-sm">Searching…</p>
            </div>
          ) : searchResults != null ? (
            <SearchResultsView
              results={searchResults}
              query={searchQuery}
              onOpen={handleItemDoubleClick}
              onDownload={(item) => downloadFile(item)}
              onRename={handleRename}
              onDelete={(path) => handleDeleteConfirm(path)}
              onMoveTo={(paths) => handleMoveToOpen(paths)}
            />
          ) : viewMode === "list" ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead
                      className="w-[400px] cursor-pointer px-6 text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("name")}
                    >
                      Ad {sortIcon("name")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("size")}
                    >
                      Boyut {sortIcon("size")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("updatedAt")}
                    >
                      Değiştirilme {sortIcon("updatedAt")}
                    </TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-64 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <FolderIcon className="size-12 opacity-10" />
                          <p>Bu dizinde dosya bulunamadı.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {displayItems.map((item) => {
                    const isSelected = selectedPaths.has(item.path)
                    const isParentDir = item.name === ".."
                    const isCut = !isParentDir && isCutItem(item.path)

                    const tableRow = (
                      <TableRow
                        key={item.path + item.name}
                        data-file-path={item.path}
                        data-drag-handle={!isParentDir ? "true" : undefined}
                        draggable={!isParentDir}
                        onDragStart={(e) => handleDragStart(e, item)}
                        onDragOver={(e) => {
                          if (item.isDirectory) e.preventDefault()
                        }}
                        onDragEnter={(e) => {
                          if (item.isDirectory) {
                            e.preventDefault()
                            e.currentTarget.setAttribute("data-drop-target", "true")
                          }
                        }}
                        onDragLeave={(e) =>
                          e.currentTarget.removeAttribute("data-drop-target")
                        }
                        onDrop={(e) => {
                          e.currentTarget.removeAttribute("data-drop-target")
                          handleDrop(e, item)
                        }}
                        className={cn(
                          "group cursor-pointer border-b border-border/50 transition-colors last:border-0",
                          isSelected
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "hover:bg-muted/30",
                          "data-[drop-target=true]:bg-primary/20",
                          isParentDir && "text-muted-foreground/60",
                          isCut && "opacity-40"
                        )}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleSelect(item, e.shiftKey || e.metaKey || e.ctrlKey)
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          handleItemDoubleClick(item)
                        }}
                      >
                        <TableCell className="px-6 py-3 font-medium">
                          <div className="flex items-center gap-3">
                            {getFileIcon(item)}
                            <span className="truncate font-mono text-sm">{item.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {item.isDirectory
                            ? item.childCount !== undefined
                              ? `${item.childCount} items`
                              : "--"
                            : formatSize(item.size)}
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {isParentDir ? "--" : format(new Date(item.updatedAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="px-6 py-0"
                        >
                          {!isParentDir && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreVerticalIcon className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleItemDoubleClick(item)}
                                >
                                  <ExternalLinkIcon className="size-3.5" /> Aç
                                </DropdownMenuItem>
                                {!item.isDirectory && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => downloadFile(item)}
                                  >
                                    <DownloadIcon className="size-3.5" /> İndir
                                  </DropdownMenuItem>
                                )}
                                {item.isDirectory && !isPinned(item.path) && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => pin({ name: item.name, path: item.path })}
                                  >
                                    <PinIcon className="size-3.5" /> Sabitle
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleCopy([item.path])}
                                >
                                  <CopyIcon className="size-3.5" /> Kopyala
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleCut([item.path])}
                                >
                                  <ScissorsIcon className="size-3.5" /> Kes
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleRename(item)}
                                >
                                  <PencilIcon className="size-3.5" /> Yeniden Adlandır
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleMoveToOpen([item.path])}
                                >
                                  <MoveIcon className="size-3.5" /> Taşı
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteConfirm(item.path)}
                                >
                                  <Trash2Icon className="size-3.5" /> Sil
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </TableRow>
                    )

                    if (isParentDir) return tableRow

                    return (
                      <ContextMenu key={item.path}>
                        <ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleItemDoubleClick(item)}
                          >
                            <ExternalLinkIcon className="size-4" /> Aç
                          </ContextMenuItem>
                          {!item.isDirectory && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => downloadFile(item)}
                            >
                              <DownloadIcon className="size-4" /> İndir
                            </ContextMenuItem>
                          )}
                          {item.isDirectory && !isPinned(item.path) && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => pin({ name: item.name, path: item.path })}
                            >
                              <PinIcon className="size-4" /> Sabitle
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleCopy([item.path])}
                          >
                            <CopyIcon className="size-4" /> Kopyala
                          </ContextMenuItem>
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleCut([item.path])}
                          >
                            <ScissorsIcon className="size-4" /> Kes
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleRename(item)}
                          >
                            <PencilIcon className="size-4" /> Yeniden Adlandır
                          </ContextMenuItem>
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleMoveToOpen([item.path])}
                          >
                            <MoveIcon className="size-4" /> Taşı
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDeleteConfirm(item.path)}
                          >
                            <Trash2Icon className="size-4" /> Sil
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <FileGrid
              items={displayItems}
              selectedPaths={selectedPaths}
              onSelect={handleSelect}
              onNavigate={(p) => router.push(`/files/${p}`)}
              currentPath={currentPath}
              onRename={handleRename}
              onDelete={(path) => handleDeleteConfirm(path)}
              onMoveTo={(paths) => handleMoveToOpen(paths)}
              clipboard={clipboard}
              onCopy={handleCopy}
              onCut={handleCut}
            />
          )}
        </div>

        {showPreview && activeItem && (
          <FilePreviewPanel item={activeItem} onClose={() => setActiveItem(null)} />
        )}

        {/* Bulk action bar — appears when 2+ items are selected */}
        {selectedPaths.size >= 2 && (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
            <span className="mr-2 text-sm font-semibold tabular-nums">
              {selectedPaths.size} seçili
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={handleBulkDownload}
            >
              <DownloadIcon className="size-3.5" /> İndir
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleCopy(Array.from(selectedPaths))}
            >
              <CopyIcon className="size-3.5" /> Kopyala
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleCut(Array.from(selectedPaths))}
            >
              <ScissorsIcon className="size-3.5" /> Kes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleMoveToOpen(Array.from(selectedPaths))}
            >
              <MoveIcon className="size-3.5" /> Taşı
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDeleteConfirm(Array.from(selectedPaths))}
            >
              <Trash2Icon className="size-3.5" /> Sil
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="ml-1 size-7 p-0"
              onClick={() => {
                setSelectedPaths(new Set())
                setActiveItem(null)
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}

        {/* Paste hint bar — shown when clipboard is active and no bulk selection */}
        {clipboard && selectedPaths.size < 2 && (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-primary/30 bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
            <ClipboardPasteIcon className="size-3.5 text-primary" />
            <span className="text-sm text-muted-foreground">
              {clipboard.paths.length === 1 ? "1 öğe" : `${clipboard.paths.length} öğe`}
              {clipboard.mode === "cut" ? " kesildi" : " kopyalandı"}
            </span>
            <Button
              size="sm"
              variant="default"
              className="ml-1 h-7 gap-1.5 text-xs"
              onClick={handlePaste}
            >
              <ClipboardPasteIcon className="size-3.5" /> Yapıştır
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-muted-foreground"
              onClick={() => setClipboard(null)}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeniden Adlandır</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doRename()
              if (e.key === "Escape") setRenameOpen(false)
            }}
            autoFocus
            className="mt-1"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              İptal
            </Button>
            <Button onClick={doRename} disabled={!renameValue.trim()}>
              Yeniden Adlandır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletePaths.length === 1 ? "Bu öğe çöp kutusuna taşınsın mı?" : `${deletePaths.length} öğe çöp kutusuna taşınsın mı?`}
            </AlertDialogTitle>
            <AlertDialogDescription>Öğeler 7 gün sonra otomatik olarak kalıcı şekilde silinir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Çöp Kutusuna Taşı
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move-to Dialog */}
      <Dialog open={moveToOpen} onOpenChange={setMoveToOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Taşı</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Mevcut dizinde bir hedef klasör seçin:
            </p>
            {folderChoices.length === 0 ? (
              <p className="rounded-lg bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                Burada klasör yok. Aşağıya bir yol yazın.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {folderChoices.map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      moveToTarget === folder.path && "bg-primary/10 text-primary"
                    )}
                    onClick={() => setMoveToTarget(folder.path)}
                  >
                    <FolderIcon className="size-4 shrink-0 fill-blue-500/20 text-blue-500" />
                    {folder.name}
                  </button>
                ))}
              </div>
            )}
            <Input
              placeholder="Veya bir yol yazın (örn. Belgeler/Projeler)"
              value={moveToTarget}
              onChange={(e) => setMoveToTarget(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToOpen(false)}>
              İptal
            </Button>
            <Button onClick={doMoveTo} disabled={!moveToTarget.trim()}>
              Taşı
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}