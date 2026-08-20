"use client"

/**
 * file-explorer-helpers.tsx
 * Pure helpers and presentational components shared across the file explorer.
 *   - TYPE_ICON_MAP / TYPE_LABEL_MAP  (mime-type → icon / label)
 *   - FileThumbnail                   (lazy image thumbnail or icon)
 *   - FileTypeBadge                   (type pill)
 *   - StarredStrip                    (starred files horizontal bar)
 */

import * as React from "react"
import {
  FolderIcon,
  ImageIcon,
  VideoIcon,
  Music2Icon,
  FileTextIcon,
  FileSpreadsheetIcon,
  PresentationIcon,
  ArchiveIcon,
  CodeIcon,
  FileIcon,
  StarIcon,
} from "lucide-react"
import { getFileIcon, isImageFile, getPreviewUrl, type FileItem } from "./file-utils"

// ---------------------------------------------------------------------------
// Icon + label maps
// ---------------------------------------------------------------------------

export const TYPE_ICON_MAP: Record<string, React.ReactNode> = {
  folder: <FolderIcon className="size-5 text-amber-400" />,
  image: <ImageIcon className="size-5 text-blue-400" />,
  video: <VideoIcon className="size-5 text-purple-400" />,
  audio: <Music2Icon className="size-5 text-pink-400" />,
  pdf: <FileTextIcon className="size-5 text-red-400" />,
  word: <FileTextIcon className="size-5 text-blue-500" />,
  excel: <FileSpreadsheetIcon className="size-5 text-green-500" />,
  powerpoint: <PresentationIcon className="size-5 text-orange-400" />,
  archive: <ArchiveIcon className="size-5 text-yellow-500" />,
  code: <CodeIcon className="size-5 text-emerald-400" />,
  markdown: <FileTextIcon className="size-5 text-slate-400" />,
  text: <FileTextIcon className="size-5 text-muted-foreground" />,
  file: <FileIcon className="size-5 text-muted-foreground" />,
}

export const TYPE_LABEL_MAP: Record<string, string> = {
  folder: "Klasör",
  image: "Görsel",
  video: "Video",
  audio: "Ses",
  pdf: "PDF",
  word: "Word",
  excel: "Excel",
  powerpoint: "PowerPoint",
  archive: "Arşiv",
  code: "Kod",
  markdown: "Markdown",
  text: "Metin",
  file: "Dosya",
}

// ---------------------------------------------------------------------------
// FileThumbnail — image files get a lazy thumbnail; others get the type icon
// ---------------------------------------------------------------------------

export function FileThumbnail({ item }: { item: FileItem }) {
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)
  const isImage = isImageFile(item)

  React.useEffect(() => {
    if (!isImage) return
    let cancelled = false
    getPreviewUrl(item).then((url) => {
      if (!cancelled) setThumbUrl(url)
    }).catch(() => {
      if (!cancelled) setFailed(true)
    })
    return () => { cancelled = true }
  }, [item, isImage])

  if (isImage && thumbUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbUrl}
        alt={item.name}
        className="size-8 rounded object-cover shrink-0 border border-border/40"
        onError={() => setFailed(true)}
      />
    )
  }

  const iconType = getFileIcon(item)
  return (
    <span className="size-8 flex items-center justify-center shrink-0">
      {TYPE_ICON_MAP[iconType] ?? TYPE_ICON_MAP.file}
    </span>
  )
}

// ---------------------------------------------------------------------------
// FileTypeBadge — small pill showing the human-readable file type
// ---------------------------------------------------------------------------

export function FileTypeBadge({ item }: { item: FileItem }) {
  const iconType = getFileIcon(item)
  const label = TYPE_LABEL_MAP[iconType] ?? "Dosya"
  return (
    <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// StarredStrip — horizontal row of starred items at the top of the explorer
// ---------------------------------------------------------------------------

export function StarredStrip({
  currentPath,
  onOpen,
}: {
  currentPath: string
  onOpen: (item: FileItem) => void
}) {
  const [starred, setStarred] = React.useState<FileItem[]>([])

  const loadStarred = React.useCallback(async () => {
    try {
      const { listStarred } = await import("@/lib/actions/files")
      const { fileRecordToItem } = await import("./file-utils")
      const records = await listStarred()
      setStarred(records.map(fileRecordToItem))
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStarred()
  }, [loadStarred, currentPath])

  React.useEffect(() => {
    window.addEventListener("wms:files:changed", loadStarred)
    return () => window.removeEventListener("wms:files:changed", loadStarred)
  }, [loadStarred])

  if (starred.length === 0) return null

  return (
    <div className="border-b border-border px-6 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />
        Yıldızlılar
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {starred.map((item) => (
          <button
            key={item.id}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted/80 transition-colors max-w-[180px]"
            onDoubleClick={() => onOpen(item)}
            onClick={() => onOpen(item)}
            title={item.path}
          >
            <span className="shrink-0">{TYPE_ICON_MAP[getFileIcon(item)] ?? TYPE_ICON_MAP.file}</span>
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}