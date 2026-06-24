"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FileIcon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  Trash2Icon,
  DownloadIcon,
  FileTextIcon,
  ImageIcon,
  FileBoxIcon,
  ExternalLinkIcon,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Button } from "@/components/ui/button"
import { FileItem, deleteItem, moveItem } from "@/lib/actions/files"
import { cn } from "@/lib/utils"
import { FileGrid } from "./file-grid"
import { FilePreviewPanel } from "./file-preview-panel"
import { SelectionLasso } from "./selection-lasso"
import { toast } from "sonner"

interface FileExplorerProps {
  items: FileItem[]
  currentPath: string
  viewMode: "grid" | "list"
  showPreview: boolean
  onTogglePreview: () => void
}

export function FileExplorer({
  items,
  currentPath,
  viewMode,
  showPreview,
  onTogglePreview,
}: FileExplorerProps) {
  const router = useRouter()
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(
    new Set()
  )
  const [activeItem, setActiveItem] = React.useState<FileItem | null>(null)

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.isDirectory) {
      router.push(`/files/${item.path}`)
    } else {
      window.open(`/api/files/raw?path=${item.path}`, "_blank")
    }
  }

  const handleDelete = async (path: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
      const res = await deleteItem(path)
      if (res.success) {
        toast.success("Item deleted")
        router.refresh()
      }
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const getFileIcon = (item: FileItem, size = "size-4") => {
    if (item.isDirectory)
      return (
        <FolderIcon className={cn(size, "fill-blue-500/20 text-blue-500")} />
      )
    const ext = item.name.split(".").pop()?.toLowerCase()
    switch (ext) {
      case "txt":
      case "md":
        return <FileTextIcon className={cn(size, "text-muted-foreground")} />
      case "png":
      case "jpg":
      case "jpeg":
      case "svg":
        return <ImageIcon className={cn(size, "text-orange-500")} />
      case "zip":
      case "rar":
        return <FileBoxIcon className={cn(size, "text-purple-500")} />
      default:
        return <FileIcon className={cn(size, "text-muted-foreground")} />
    }
  }

  const handleLassoChange = React.useCallback(
    (
      rect: { top: number; left: number; width: number; height: number } | null
    ) => {
      if (!rect) return

      const newSelected = new Set<string>()
      const container = containerRef.current
      if (!container) return

      const itemElements = container.querySelectorAll("[data-file-path]")
      itemElements.forEach((el) => {
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()

        const relativeElRect = {
          top: elRect.top - containerRect.top + container.scrollTop,
          left: elRect.left - containerRect.left + container.scrollLeft,
          width: elRect.width,
          height: elRect.height,
        }

        const intersects =
          rect.left < relativeElRect.left + relativeElRect.width &&
          rect.left + rect.width > relativeElRect.left &&
          rect.top < relativeElRect.top + relativeElRect.height &&
          rect.top + rect.height > relativeElRect.top

        if (intersects) {
          const path = (el as HTMLElement).dataset.filePath
          if (path) newSelected.add(path)
        }
      })

      setSelectedPaths((prev) => {
        if (
          prev.size === newSelected.size &&
          Array.from(newSelected).every((p) => prev.has(p))
        ) {
          return prev
        }
        return newSelected
      })

      if (newSelected.size > 0) {
        const firstPath = Array.from(newSelected)[0]
        const firstItem = items.find((i) => i.path === firstPath)
        if (firstItem) {
          setActiveItem((prev) =>
            prev?.path === firstItem.path ? prev : firstItem
          )
        }
      }
    },
    [items]
  )

  const displayItems = React.useMemo(() => {
    if (currentPath === "") return items
    const parentPath = currentPath.includes("/")
      ? currentPath.split("/").slice(0, -1).join("/")
      : ""
    const parentItem: FileItem = {
      name: "..",
      path: parentPath,
      isDirectory: true,
      size: 0,
      updatedAt: new Date().toISOString(),
    }
    return [parentItem, ...items]
  }, [items, currentPath])

  const handleSelect = (item: FileItem, isMulti = false) => {
    if (item.name === "..") return
    if (isMulti) {
      const newSelected = new Set(selectedPaths)
      if (newSelected.has(item.path)) newSelected.delete(item.path)
      else newSelected.add(item.path)
      setSelectedPaths(newSelected)
    } else {
      setSelectedPaths(new Set([item.path]))
    }
    setActiveItem(item)
  }

  // --- Drag and Drop Logic (Native) ---
  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
    if (item.name === "..") {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData("application/workos-file", item.path)
    e.dataTransfer.effectAllowed = "move"

    // Create drag ghost
    const ghost = document.createElement("div")
    ghost.className =
      "bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl border border-white/20"
    ghost.innerText =
      selectedPaths.size > 1
        ? `Moving ${selectedPaths.size} items`
        : `Moving ${item.name}`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDrop = async (e: React.DragEvent, targetItem: FileItem) => {
    e.preventDefault()
    if (!targetItem.isDirectory) return

    const sourcePath = e.dataTransfer.getData("application/workos-file")
    if (!sourcePath || sourcePath === targetItem.path) return

    const itemsToMove = selectedPaths.has(sourcePath)
      ? Array.from(selectedPaths)
      : [sourcePath]

    // Prevent moving an item into its current parent (if target is ..)
    // But targetItem.path is already the parent path, so moveItem will handle it or fail if source equals destination

    const movePromises = itemsToMove.map((path) =>
      moveItem(path, targetItem.path)
    )
    const results = await Promise.all(movePromises)

    const successCount = results.filter((r) => r.success).length
    if (successCount > 0) {
      toast.success(
        `${successCount} item(s) moved to ${targetItem.name === ".." ? "parent directory" : targetItem.name}`
      )
      router.refresh()
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 overflow-hidden select-none"
      onClick={() => {
        setSelectedPaths(new Set())
        setActiveItem(null)
      }}
    >
      <SelectionLasso
        containerRef={containerRef}
        onSelectionChange={handleLassoChange}
      />

      <div className="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto p-6">
        {viewMode === "list" ? (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow className="border-b border-border hover:bg-transparent">
                  <TableHead className="w-[400px] px-6 text-[10px] font-bold tracking-wider uppercase">
                    Name
                  </TableHead>
                  <TableHead className="text-[10px] font-bold tracking-wider uppercase">
                    Size
                  </TableHead>
                  <TableHead className="text-[10px] font-bold tracking-wider uppercase">
                    Modified
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
                          e.currentTarget.setAttribute(
                            "data-drop-target",
                            "true"
                          )
                        }
                      }}
                      onDragLeave={(e) => {
                        e.currentTarget.removeAttribute("data-drop-target")
                      }}
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
                          <span className="truncate font-mono text-sm">
                            {item.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground">
                        {item.isDirectory ? "--" : formatSize(item.size)}
                      </TableCell>
                      <TableCell className="font-sans text-xs text-muted-foreground">
                        {isParentDir
                          ? "--"
                          : format(new Date(item.updatedAt), "MMM d, yyyy")}
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
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem
                                className="gap-2"
                                onClick={() => handleItemDoubleClick(item)}
                              >
                                <ExternalLinkIcon className="size-3.5" />
                                Open
                              </DropdownMenuItem>
                              <DropdownMenuItem className="gap-2">
                                <PencilIcon className="size-3.5" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleDelete(item.path)}
                              >
                                <Trash2Icon className="size-3.5" />
                                Delete
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
                      <ContextMenuTrigger asChild>
                        {tableRow}
                      </ContextMenuTrigger>
                      <ContextMenuContent className="w-48">
                        <ContextMenuItem
                          className="gap-2"
                          onClick={() => handleItemDoubleClick(item)}
                        >
                          <ExternalLinkIcon className="size-4" /> Open
                        </ContextMenuItem>
                        <ContextMenuItem className="gap-2">
                          <PencilIcon className="size-4" /> Rename
                        </ContextMenuItem>
                        <ContextMenuItem
                          className="gap-2 text-destructive focus:text-destructive"
                          onClick={() => handleDelete(item.path)}
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
          />
        )}
      </div>

      {showPreview && activeItem && (
        <FilePreviewPanel
          item={activeItem}
          onClose={() => setActiveItem(null)}
        />
      )}
    </div>
  )
}
