"use client"

import * as React from "react"
import {
  ImageIcon,
  ExternalLinkIcon,
  PencilIcon,
  PinIcon,
  Trash2Icon,
  DownloadIcon,
  MoveIcon,
  CopyIcon,
  ScissorsIcon,
} from "lucide-react"
import type { FileItem } from "@/components/files/file-utils"
import { cn } from "@/lib/utils"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { toast } from "sonner"
import { getFileIcon, isImageFile, getFileOpenUrl, downloadFile } from "./file-utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

type Clipboard = { paths: string[]; mode: "copy" | "cut" } | null

interface FileGridProps {
  items: FileItem[]
  currentPath: string
  selectedPaths: Set<string>
  onSelect: (item: FileItem, isMulti?: boolean) => void
  onNavigate: (path: string) => void
  onRename: (item: FileItem) => void
  onDelete: (id: string) => void
  onMoveTo: (ids: string[]) => void
  onDownload?: (item: FileItem) => void
  clipboard?: Clipboard
  onCopy?: (ids: string[]) => void
  onCut?: (ids: string[]) => void
  onPin?: (f: { name: string; path: string }) => void
  isPinned?: (path: string) => boolean
}

function ImageThumbnail({ item }: { item: FileItem }) {
  const [src, setSrc] = React.useState<string | null>(null)
  const [error, setError] = React.useState(false)

  React.useEffect(() => {
    if (!isImageFile(item) || !item.id) return
    import("@/lib/actions/files")
      .then(({ getPreviewUrl }) => getPreviewUrl(item.id))
      .then(setSrc)
      .catch(() => setError(true))
  }, [item])

  if (error || !src) return <ImageIcon className="size-12 text-orange-500" />

  return (
    <div className="size-14 overflow-hidden rounded-lg border border-border/50 bg-muted/30">
      <img
        src={src}
        alt={item.name}
        className="size-full object-cover"
        onError={() => setError(true)}
      />
    </div>
  )
}


function DndGridCard({
  item,
  selected,
  isCut,
  onClick,
  onDoubleClick,
  children,
}: {
  item: import("@/components/files/file-utils").FileItem
  selected: boolean
  isCut: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
    transform,
  } = useDraggable({
    id: `drag-${item.id}`,
    data: { item },
    disabled: Boolean(item.isDriveFile),
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `dnd-folder-${item.id}`,
    data: { item },
    disabled: item.type !== "folder",
  })

  const setRef = (el: HTMLDivElement | null) => {
    setDragRef(el as unknown as HTMLElement)
    if (item.type === "folder") setDropRef(el as unknown as HTMLElement)
  }

  return (
    <div
      ref={setRef}
      {...(item.isDriveFile ? {} : { ...listeners, ...attributes })}
      style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.4 : isCut ? 0.4 : 1 }}
      className={cn(
        "group relative flex cursor-pointer flex-col items-center gap-2 rounded-xl border p-3 transition-all",
        selected
          ? "border-primary/50 bg-primary/5 ring-2 ring-primary/20"
          : "border-border bg-card hover:border-primary/30 hover:bg-muted/30",
        item.type === "folder" && isOver && "border-primary bg-primary/10 ring-2 ring-primary/40",
        isDragging && "z-50 shadow-xl"
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      {children}
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
  onDownload,
  clipboard,
  onCopy,
  onCut,
  onPin,
  isPinned,
}: FileGridProps) {

  const isCutItem = (path: string) =>
    clipboard?.mode === "cut" && clipboard.paths.includes(path)

  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
    if (item.isDriveFile) { e.preventDefault(); return }
    e.dataTransfer.setData("application/workos-file-id", item.id)
    e.dataTransfer.setData("application/workos-file-path", item.path)
    e.dataTransfer.effectAllowed = "move"
    const ghost = document.createElement("div")
    ghost.className =
      "bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl border border-white/20"
    ghost.innerText =
      selectedPaths.size > 1 ? `${selectedPaths.size} öğe taşınıyor` : `${item.name} taşınıyor`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }


  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
      {items.map((item) => {
        const isSelected = selectedPaths.has(item.path)
        const isParentDir = item.name === ".."
        const isCut = !isParentDir && isCutItem(item.path)
        const iconName = getFileIcon(item)
        const pinned = isPinned?.(item.path) ?? false

        const gridItem = (
          <DndGridCard
            item={item}
            selected={isSelected}
            isCut={isCut}
            onClick={(e) => {
              e.stopPropagation()
              if (isParentDir) { onNavigate(item.path); return }
              onSelect(item, e.metaKey || e.ctrlKey || e.shiftKey)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              if (item.type === "folder") onNavigate(item.path)
              else window.open(getFileOpenUrl(item), "_blank")
            }}
          >
            <div className="flex size-14 items-center justify-center">
              {isImageFile(item) && item.id ? (
                <ImageThumbnail item={item} />
              ) : (
                <div className={cn(
                  "flex size-14 items-center justify-center rounded-xl",
                  item.type === "folder"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted/50 text-muted-foreground",
                )}>
                  <span className="text-3xl">{iconName === "folder" ? "📁" : "📄"}</span>
                </div>
              )}
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <span className="max-w-full truncate text-center text-xs font-medium leading-tight">
                  {item.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="max-w-xs break-all text-xs">{item.name}</p>
              </TooltipContent>
            </Tooltip>
          </DndGridCard>
        )

        if (isParentDir) return gridItem

        return (
          <ContextMenu key={item.path + item.name}>
            <ContextMenuTrigger asChild>{gridItem}</ContextMenuTrigger>
            <ContextMenuContent className="w-52">
              {item.type === "folder" && (
                <ContextMenuItem className="gap-2" onClick={() => onNavigate(item.path)}>
                  <ExternalLinkIcon className="size-4" /> Aç
                </ContextMenuItem>
              )}
              {item.type !== "folder" && (
                <ContextMenuItem
                  className="gap-2"
                  onClick={() => onDownload ? onDownload(item) : downloadFile(item)}
                >
                  <DownloadIcon className="size-4" /> İndir
                </ContextMenuItem>
              )}
              {item.type === "folder" && onPin && !pinned && (
                <ContextMenuItem
                  className="gap-2"
                  onClick={() => onPin({ name: item.name, path: item.path })}
                >
                  <PinIcon className="size-4" /> Sabitle
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
              {onCopy && !item.isDriveFile && (
                <ContextMenuItem
                  className="gap-2"
                  onClick={() => onCopy([item.id])}
                >
                  <CopyIcon className="size-4" /> Kopyala
                </ContextMenuItem>
              )}
              {onCut && !item.isDriveFile && (
                <ContextMenuItem
                  className="gap-2"
                  onClick={() => onCut([item.id])}
                >
                  <ScissorsIcon className="size-4" /> Kes
                </ContextMenuItem>
              )}
              {!item.isDriveFile && (
                <>
                  <ContextMenuSeparator />
                  <ContextMenuItem className="gap-2" onClick={() => onRename(item)}>
                    <PencilIcon className="size-4" /> Yeniden Adlandır
                  </ContextMenuItem>
                  <ContextMenuItem className="gap-2" onClick={() => onMoveTo([item.id])}>
                    <MoveIcon className="size-4" /> Taşı
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    className="gap-2 text-destructive focus:text-destructive"
                    onClick={() => onDelete(item.id)}
                  >
                    <Trash2Icon className="size-4" /> Çöp Kutusuna Taşı
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        )
      })}
    </div>
  )
}