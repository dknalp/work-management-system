"use client"

/**
 * file-explorer-row.tsx
 * Single file/folder row inside the FileExplorer table.
 * Wraps the row in a ContextMenu; the kebab DropdownMenu lives inside the
 * last TableCell. All interaction handlers are passed as props — no internal
 * state (other than the lazy thumbnail inside FileThumbnail).
 */

import * as React from "react"
import {
  Share2Icon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  StarIcon,
  Trash2Icon,
  ExternalLinkIcon,
  ChevronUpIcon,
  CopyIcon,
  ScissorsIcon,
  DownloadIcon,
  MoveRightIcon,
  InfoIcon,
} from "lucide-react"
import { TableCell, TableRow } from "@/components/ui/table"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { FileItem } from "./file-utils"
import { FileThumbnail } from "./file-explorer-helpers"
import { starFile } from "@/lib/actions/files"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface FileRowProps {
  item: FileItem
  isSelected: boolean
  isCut: boolean
  dragOverPath: string | null
  /** Item was single-clicked */
  onSelect: (item: FileItem, multi: boolean) => void
  /** Item was double-clicked (open/navigate) */
  onDoubleClick: (item: FileItem) => void
  onDragStart: (e: React.DragEvent<HTMLTableRowElement>, item: FileItem) => void
  onDragOver: (e: React.DragEvent<HTMLTableRowElement>, item: FileItem) => void
  onDragLeave: (e: React.DragEvent<HTMLTableRowElement>) => void
  onDrop: (e: React.DragEvent<HTMLTableRowElement>, item: FileItem) => void
  onRename: (item: FileItem) => void
  onDelete: (item: FileItem) => void
  onCopy: (item: FileItem) => void
  onCut: (item: FileItem) => void
  onDownload: (item: FileItem) => void
  onMoveTo: (item: FileItem) => void
  onShare: (item: FileItem) => void
  onOpenDetail: (item: FileItem) => void
  /** Propagate star update to parent so the list refreshes */
  onStarToggle: (itemId: string, isStarred: boolean) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FileRow({
  item,
  isSelected,
  isCut,
  dragOverPath,
  onSelect,
  onDoubleClick,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onRename,
  onDelete,
  onCopy,
  onCut,
  onDownload,
  onMoveTo,
  onShare,
  onOpenDetail,
  onStarToggle,
}: FileRowProps) {
  const isParentDir = item.name === ".."
  const isDrive = item.isDriveFile

  const handleStarClick = React.useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      try {
        const updated = await starFile(item.id)
        onStarToggle(item.id, updated.is_starred ?? false)
      } catch { /* ignore */ }
    },
    [item.id, onStarToggle]
  )

  // ContextMenu items — same set as DropdownMenu
  const menuItems = (
    <>
      {!isParentDir && (
        <>
          <ContextMenuItem className="gap-2" onClick={() => onRename(item)}>
            <PencilIcon className="size-4" /> Yeniden Adlandır
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onClick={() => onCopy(item)}>
            <CopyIcon className="size-4" /> Kopyala
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onClick={() => onCut(item)}>
            <ScissorsIcon className="size-4" /> Kes
          </ContextMenuItem>
          <ContextMenuItem className="gap-2" onClick={() => onMoveTo(item)}>
            <MoveRightIcon className="size-4" /> Taşı
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2" onClick={() => onDoubleClick(item)}>
            <ExternalLinkIcon className="size-4" /> Aç
          </ContextMenuItem>
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <Share2Icon className="size-4" /> Birlikte Aç
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-44">
              <ContextMenuItem className="gap-2" onClick={() => {}}>
                <ExternalLinkIcon className="size-4" /> Metin Editörü
              </ContextMenuItem>
              <ContextMenuItem className="gap-2" onClick={() => {}}>
                <ExternalLinkIcon className="size-4" /> Web Tarayıcısı
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
          {!isDrive && (
            <ContextMenuItem className="gap-2" onClick={() => onDownload(item)}>
              <DownloadIcon className="size-4" /> İndir
            </ContextMenuItem>
          )}
          <ContextMenuItem className="gap-2" onClick={() => onShare(item)}>
            <Share2Icon className="size-4" /> Paylaş
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="gap-2" onClick={() => onOpenDetail(item)}>
            <InfoIcon className="size-4" /> Bilgi
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            className="gap-2 text-destructive focus:text-destructive"
            onClick={() => onDelete(item)}
          >
            <Trash2Icon className="size-4" /> Çöp Kutusuna Taşı
          </ContextMenuItem>
        </>
      )}
      {isParentDir && (
        <ContextMenuItem className="gap-2" onClick={() => onDoubleClick(item)}>
          <ChevronUpIcon className="size-4" /> Üst Klasöre Git
        </ContextMenuItem>
      )}
    </>
  )

  const row = (
    <TableRow
      data-file-path={item.path}
      draggable={!isParentDir && !isDrive}
      className={cn(
        "group cursor-pointer border-b border-border/50 transition-colors last:border-0",
        isSelected ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30",
        isParentDir && "text-muted-foreground/60",
        isCut && "opacity-40",
        dragOverPath === item.path && "bg-primary/10 ring-1 ring-inset ring-primary/40"
      )}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item, e.shiftKey || e.metaKey || e.ctrlKey)
      }}
      onDoubleClick={(e) => {
        e.stopPropagation()
        onDoubleClick(item)
      }}
      onDragStart={(e) => onDragStart(e, item)}
      onDragOver={(e) => onDragOver(e, item)}
      onDragLeave={(e) => onDragLeave(e)}
      onDrop={(e) => onDrop(e, item)}
    >
      {/* Name */}
      <TableCell className="px-6 py-3 font-medium">
        <div className="flex items-center gap-3">
          <FileThumbnail item={item} />
          <span className="truncate text-sm">{item.name}</span>
          {!isParentDir && (
            <button
              onClick={handleStarClick}
              className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 p-0.5 rounded hover:bg-accent"
              onPointerDown={(e) => e.stopPropagation()}
              title={item.is_starred ? "Yıldızı kaldır" : "Yıldızla"}
            >
              <StarIcon
                className={cn(
                  "size-3.5",
                  item.is_starred
                    ? "fill-yellow-400 text-yellow-400 opacity-100"
                    : "text-muted-foreground"
                )}
              />
            </button>
          )}
          {item.is_starred && (
            <StarIcon className="size-3 fill-yellow-400 text-yellow-400 shrink-0 ml-1" />
          )}
        </div>
      </TableCell>

      {/* Type */}
      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
        {isParentDir ? (
          <span className="flex items-center gap-1.5">
            <FolderIcon className="size-4 text-amber-400" />
            Klasör
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            {item.type === "folder"
              ? <FolderIcon className="size-4 text-amber-400" />
              : null}
            {item.type === "folder" ? "Klasör" : item.mimeType ?? "Dosya"}
          </span>
        )}
      </TableCell>

      {/* Size */}
      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
        {item.type === "folder" || isParentDir ? "—" : formatBytes(item.size)}
      </TableCell>

      {/* Modified */}
      <TableCell className="px-4 py-3 text-sm text-muted-foreground">
        {item.lastModified ? formatDate(item.lastModified) : "—"}
      </TableCell>

      {/* Actions kebab */}
      <TableCell className="px-4 py-3 text-right">
        {!isParentDir && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVerticalIcon className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem className="gap-2" onClick={() => onRename(item)}>
                <PencilIcon className="size-4" /> Yeniden Adlandır
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onCopy(item)}>
                <CopyIcon className="size-4" /> Kopyala
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onCut(item)}>
                <ScissorsIcon className="size-4" /> Kes
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onMoveTo(item)}>
                <MoveRightIcon className="size-4" /> Taşı
              </DropdownMenuItem>
              {!isDrive && (
                <DropdownMenuItem className="gap-2" onClick={() => onDownload(item)}>
                  <DownloadIcon className="size-4" /> İndir
                </DropdownMenuItem>
              )}
              <DropdownMenuItem className="gap-2" onClick={() => onShare(item)}>
                <Share2Icon className="size-4" /> Paylaş
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2" onClick={() => onOpenDetail(item)}>
                <InfoIcon className="size-4" /> Bilgi
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {item.type === "folder" && (
                <DropdownMenuItem className="gap-2" onClick={() => {}}>
                  <PinIcon className="size-4" /> Sabitle
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onClick={() => onDelete(item)}
              >
                <Trash2Icon className="size-4" /> Çöp Kutusuna Taşı
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )

  if (isParentDir) return row

  return (
    <ContextMenu key={item.path + item.name}>
      <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
      <ContextMenuContent className="w-52">{menuItems}</ContextMenuContent>
    </ContextMenu>
  )
}

// ---------------------------------------------------------------------------
// Local formatting helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes?: number): string {
  if (bytes == null) return "—"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}