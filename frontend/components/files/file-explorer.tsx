"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
  ExternalLinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  MoveIcon,
  XIcon,
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
import { FileItem, deleteItem, moveItem, renameItem } from "@/lib/actions/files"
import { cn } from "@/lib/utils"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { FileGrid } from "./file-grid"
import { FilePreviewPanel } from "./file-preview-panel"
import { SelectionLasso } from "./selection-lasso"
import { getFileIcon, formatSize } from "./file-utils"
import { toast } from "sonner"

interface FileExplorerProps {
  items: FileItem[]
  currentPath: string
  viewMode: "grid" | "list"
  showPreview: boolean
  onTogglePreview: () => void
  searchQuery: string
}

function downloadFile(path: string, name: string) {
  const a = document.createElement("a")
  a.href = `/api/files/raw?path=${encodeURIComponent(path)}`
  a.download = name
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
}: FileExplorerProps) {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set())
  const [activeItem, setActiveItem] = React.useState<FileItem | null>(null)

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
      window.open(`/api/files/raw?path=${item.path}`, "_blank")
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
    const results = await Promise.all(deletePaths.map((p) => deleteItem(p)))
    const successCount = results.filter((r) => r.success).length
    if (successCount > 0) {
      toast.success(`${successCount} item(s) deleted`)
      router.refresh()
    }
    setDeleteOpen(false)
    setSelectedPaths(new Set())
    setActiveItem(null)
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
      .forEach((item) => downloadFile(item.path, item.name))
  }

  const handleSort = (key: "name" | "size" | "updatedAt") => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

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
      if (e.key === "Escape") {
        setSelectedPaths(new Set())
        setActiveItem(null)
      }
      if (e.key === "Enter" && activeItem) {
        handleItemDoubleClick(activeItem)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectedPaths, activeItem, items, renameOpen, deleteOpen])

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
          {viewMode === "list" ? (
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border hover:bg-transparent">
                    <TableHead
                      className="w-[400px] cursor-pointer px-6 text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("name")}
                    >
                      Name {sortIcon("name")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("size")}
                    >
                      Size {sortIcon("size")}
                    </TableHead>
                    <TableHead
                      className="cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("updatedAt")}
                    >
                      Modified {sortIcon("updatedAt")}
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
                          <p>No files found in this directory.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {displayItems.map((item) => {
                    const isSelected = selectedPaths.has(item.path)
                    const isParentDir = item.name === ".."

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
                          isParentDir && "text-muted-foreground/60"
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
                                  <ExternalLinkIcon className="size-3.5" /> Open
                                </DropdownMenuItem>
                                {!item.isDirectory && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => downloadFile(item.path, item.name)}
                                  >
                                    <DownloadIcon className="size-3.5" /> Download
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleRename(item)}
                                >
                                  <PencilIcon className="size-3.5" /> Rename
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleMoveToOpen([item.path])}
                                >
                                  <MoveIcon className="size-3.5" /> Move to
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="gap-2 text-destructive focus:text-destructive"
                                  onClick={() => handleDeleteConfirm(item.path)}
                                >
                                  <Trash2Icon className="size-3.5" /> Delete
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
                            <ExternalLinkIcon className="size-4" /> Open
                          </ContextMenuItem>
                          {!item.isDirectory && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => downloadFile(item.path, item.name)}
                            >
                              <DownloadIcon className="size-4" /> Download
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleRename(item)}
                          >
                            <PencilIcon className="size-4" /> Rename
                          </ContextMenuItem>
                          <ContextMenuItem
                            className="gap-2"
                            onClick={() => handleMoveToOpen([item.path])}
                          >
                            <MoveIcon className="size-4" /> Move to
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="gap-2 text-destructive focus:text-destructive"
                            onClick={() => handleDeleteConfirm(item.path)}
                          >
                            <Trash2Icon className="size-4" /> Delete
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
              {selectedPaths.size} selected
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={handleBulkDownload}
            >
              <DownloadIcon className="size-3.5" /> Download
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={() => handleMoveToOpen(Array.from(selectedPaths))}
            >
              <MoveIcon className="size-3.5" /> Move
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => handleDeleteConfirm(Array.from(selectedPaths))}
            >
              <Trash2Icon className="size-3.5" /> Delete
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
      </div>

      {/* Rename Dialog */}
      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename</DialogTitle>
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
              Cancel
            </Button>
            <Button onClick={doRename} disabled={!renameValue.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete AlertDialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deletePaths.length === 1 ? "this item" : `${deletePaths.length} items`}?
            </AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Move-to Dialog */}
      <Dialog open={moveToOpen} onOpenChange={setMoveToOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Choose a destination folder in the current directory:
            </p>
            {folderChoices.length === 0 ? (
              <p className="rounded-lg bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                No folders available here. Type a path below.
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
              placeholder="Or type a path (e.g. Documents/Projects)"
              value={moveToTarget}
              onChange={(e) => setMoveToTarget(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doMoveTo} disabled={!moveToTarget.trim()}>
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}