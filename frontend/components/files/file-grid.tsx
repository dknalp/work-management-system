"use client"

import * as React from "react"
import {
  ImageIcon,
  ExternalLinkIcon,
  PencilIcon,
  Trash2Icon,
  DownloadIcon,
  MoveIcon,
} from "lucide-react"
import { FileItem } from "@/lib/actions/files"
import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getFileIcon, isImageFile } from "./file-utils"
import { moveItem } from "@/lib/actions/files"

interface FileGridProps {
  items: FileItem[]
  currentPath: string
  selectedPaths: Set<string>
  onSelect: (item: FileItem, isMulti?: boolean) => void
  onNavigate: (path: string) => void
  onRename: (item: FileItem) => void
  onDelete: (path: string) => void
  onMoveTo: (paths: string[]) => void
}

function downloadFile(path: string, name: string) {
  const a = document.createElement("a")
  a.href = `/api/files/raw?path=${encodeURIComponent(path)}`
  a.download = name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function ImageThumbnail({ item }: { item: FileItem }) {
  const [error, setError] = React.useState(false)
  if (error) return <ImageIcon className="size-12 text-orange-500" />
  return (
    <div className="size-14 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
      <img
        src={`/api/files/raw?path=${encodeURIComponent(item.path)}`}
        alt={item.name}
        className="size-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  )
}

export function FileGrid({
  items,
  selectedPaths,
  onSelect,
  onNavigate,
  onRename,
  onDelete,
  onMoveTo,
}: FileGridProps) {
  const router = useRouter()

  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
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
      toast.success(`${successCount} item(s) moved to ${targetItem.name}`)
      router.refresh()
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {items.map((item) => {
        const isSelected = selectedPaths.has(item.path)
        const isParentDir = item.name === ".."

        const gridItem = (
          <div
            key={item.path + item.name}
            data-file-path={item.path}
            data-drag-handle={!isParentDir ? "true" : undefined}
            draggable={!isParentDir}
            onDragStart={(e) => handleDragStart(e, item)}
            onDragOver={(e) => { if (item.isDirectory) e.preventDefault() }}
            onDragEnter={(e) => {
              if (item.isDirectory) {
                e.preventDefault()
                e.currentTarget.setAttribute("data-drop-target", "true")
              }
            }}
            onDragLeave={(e) => e.currentTarget.removeAttribute("data-drop-target")}
            onDrop={(e) => {
              e.currentTarget.removeAttribute("data-drop-target")
              handleDrop(e, item)
            }}
            className={cn(
              "group flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-transparent p-3 transition-all select-none",
              isSelected ? "border-primary/20 bg-primary/10" : "hover:bg-muted/50",
              "data-[drop-target=true]:border-primary/50 data-[drop-target=true]:bg-primary/20",
              isParentDir && "opacity-60"
            )}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(item, e.shiftKey || e.metaKey || e.ctrlKey)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (item.isDirectory) {
                onNavigate(item.path)
              } else {
                window.open(`/api/files/raw?path=${item.path}`, "_blank")
              }
            }}
          >
            <div className="relative">
              {!isParentDir && isImageFile(item.name) ? (
                <ImageThumbnail item={item} />
              ) : (
                getFileIcon(item, "size-12")
              )}
            </div>
            <span
              className={cn(
                "w-full truncate px-1 text-center text-xs font-medium",
                isSelected ? "text-primary" : "text-foreground/80",
                isParentDir && "font-mono"
              )}
            >
              {item.name}
            </span>
            {item.isDirectory && item.childCount !== undefined && (
              <span className="text-[10px] text-muted-foreground/60">
                {item.childCount} items
              </span>
            )}
          </div>
        )

        if (isParentDir) return gridItem

        return (
          <ContextMenu key={item.path}>
            <ContextMenuTrigger asChild>{gridItem}</ContextMenuTrigger>
            <ContextMenuContent className="w-48">
              <ContextMenuItem
                className="gap-2"
                onClick={() =>
                  item.isDirectory
                    ? onNavigate(item.path)
                    : window.open(`/api/files/raw?path=${item.path}`, "_blank")
                }
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
              <ContextMenuItem className="gap-2" onClick={() => onRename(item)}>
                <PencilIcon className="size-4" /> Rename
              </ContextMenuItem>
              <ContextMenuItem
                className="gap-2"
                onClick={() => onMoveTo([item.path])}
              >
                <MoveIcon className="size-4" /> Move to
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete(item.path)}
              >
                <Trash2Icon className="size-4" /> Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </div>
  )
}