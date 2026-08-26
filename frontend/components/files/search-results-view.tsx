"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FolderOpenIcon,
  DownloadIcon,
  PencilIcon,
  Trash2Icon,
  MoveIcon,
  ExternalLinkIcon,
  SearchXIcon,
} from "lucide-react"
import { format } from "date-fns"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { Badge } from "@/components/ui/badge"
import type { SearchResult } from "@/components/files/file-utils"
import { getFileIcon, formatSize } from "./file-utils"
import { cn } from "@/lib/utils"

interface SearchResultsViewProps {
  results: SearchResult[]
  query: string
  onOpen: (item: SearchResult) => void
  onDownload: (item: SearchResult) => void
  onRename: (item: SearchResult) => void
  onDelete: (path: string) => void
  onMoveTo: (paths: string[]) => void
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return <>{text}</>
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const parts = text.split(new RegExp(`(${escaped})`, "gi"))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="rounded-sm bg-amber-200/60 px-0.5 text-amber-900 dark:bg-amber-800/50 dark:text-amber-100"
          >
            {part}
          </mark>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  )
}

export function SearchResultsView({
  results,
  query,
  onOpen,
  onDownload,
  onRename,
  onDelete,
  onMoveTo,
}: SearchResultsViewProps) {
  const router = useRouter()

  const navigateToFolder = (filePath: string) => {
    const parts = filePath.split("/")
    const folderPath = parts.slice(0, -1).join("/")
    router.push(folderPath ? `/files/${folderPath}` : "/files")
  }

  if (results.length === 0) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
        <SearchXIcon className="size-10 opacity-20" />
        <p className="text-sm font-medium">"{query}" için sonuç bulunamadı</p>
        <p className="text-xs opacity-60">Farklı bir arama terimi deneyin veya filtrelerde içerik aramasını etkinleştirin</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="mb-2 px-1 text-xs text-muted-foreground">
        "{query}" için {results.length} sonuç
      </p>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {results.map((item, idx) => {
          const folderPath = item.path.includes("/")
            ? item.path.split("/").slice(0, -1).join("/")
            : ""

          const row = (
            <div
              key={item.path}
              className={cn(
                "group flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/30",
                idx !== results.length - 1 && "border-b border-border/50"
              )}
              onClick={() => onOpen(item)}
            >
              <div className="mt-0.5 shrink-0">{getFileIcon(item)}</div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm font-medium">
                    {highlightText(item.name, query)}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 border text-[10px] font-medium",
                      item.matchType === "content"
                        ? "border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        : "border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                    )}
                  >
                    {item.matchType === "content" ? "İçerik" : "Ad"}
                  </Badge>
                </div>

                {item.contentSnippet && (
                  <p className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">
                    {highlightText(item.contentSnippet, query)}
                  </p>
                )}

                <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                  <button
                    type="button"
                    className="flex items-center gap-1 transition-colors hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation()
                      navigateToFolder(item.path)
                    }}
                  >
                    <FolderOpenIcon className="size-3" />
                    {folderPath || "Kök"}
                  </button>
                  <span>·</span>
                  <span>{formatSize(item.size)}</span>
                  <span>·</span>
                  <span>{item.lastModified ? format(new Date(item.lastModified), "MMM d, yyyy") : "—"}</span>
                </div>
              </div>
            </div>
          )

          return (
            <ContextMenu key={item.path}>
              <ContextMenuTrigger asChild>{row}</ContextMenuTrigger>
              <ContextMenuContent className="w-48">
                <ContextMenuItem className="gap-2" onClick={() => onOpen(item)}>
                  <ExternalLinkIcon className="size-4" /> Open
                </ContextMenuItem>
                {item.type !== "folder" && (
                  <ContextMenuItem
                    className="gap-2"
                    onClick={() => onDownload(item)}
                  >
                    <DownloadIcon className="size-4" /> Download
                  </ContextMenuItem>
                )}
                <ContextMenuSeparator />
                <ContextMenuItem className="gap-2" onClick={() => onRename(item)}>
                  <PencilIcon className="size-4" /> Rename
                </ContextMenuItem>
                <ContextMenuItem className="gap-2" onClick={() => onMoveTo([item.path])}>
                  <MoveIcon className="size-4" /> Taşı
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  className="gap-2 text-destructive focus:text-destructive"
                  onClick={() => onDelete(item.path)}
                >
                  <Trash2Icon className="size-4" /> Çöp Kutusuna Taşı
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>
          )
        })}
      </div>
    </div>
  )
}