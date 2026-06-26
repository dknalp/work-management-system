"use client"

import * as React from "react"
import {
  XIcon,
  FileIcon,
  DownloadIcon,
  InfoIcon,
  CalendarIcon,
  HardDriveIcon,
} from "lucide-react"
import { format } from "date-fns"
import { FileItem } from "@/lib/actions/files"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { isImageFile, isTextFile, formatSize } from "./file-utils"

interface FilePreviewPanelProps {
  item: FileItem | null
  onClose: () => void
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => res.text())
      .then((text) => {
        if (cancelled) return
        setContent(text.length > 10240 ? text.slice(0, 10240) + "\n\n… (truncated)" : text)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelled) {
          setContent("Önizleme yüklenemedi.")
          setLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [url])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        Yükleniyor…
      </div>
    )
  }

  let display = content ?? ""
  // Pretty-print JSON
  if (url.includes(".json") && content) {
    try {
      display = JSON.stringify(JSON.parse(content), null, 2)
    } catch {
      display = content
    }
  }

  return (
    <pre className="scrollbar-thin max-h-48 overflow-auto rounded-lg bg-muted/30 p-3 text-[10px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-words font-mono">
      {display}
    </pre>
  )
}

export function FilePreviewPanel({ item, onClose }: FilePreviewPanelProps) {
  if (!item) return null

  const isDrive = item.source === "drive" && !!item.driveFileId
  const previewUrl = isDrive
    ? `https://drive.google.com/file/d/${item.driveFileId}/preview`
    : `/api/files/raw?path=${encodeURIComponent(item.path)}`
  const imageUrl = isDrive
    ? `https://drive.google.com/thumbnail?id=${item.driveFileId}&sz=w400`
    : `/api/files/raw?path=${encodeURIComponent(item.path)}`
  const downloadUrl = isDrive
    ? `https://drive.google.com/uc?export=download&id=${item.driveFileId}`
    : `/api/files/raw?path=${encodeURIComponent(item.path)}`
  const isImage = isImageFile(item.name)
  const isText = isTextFile(item.name) && !isDrive
  const isPDF = /\.pdf$/i.test(item.name)

  return (
    <div className="flex w-80 shrink-0 animate-in flex-col border-l border-border bg-card duration-300 slide-in-from-right">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <InfoIcon className="size-4 text-primary" />
          Detaylar
        </h3>
        <Button variant="ghost" size="icon" className="size-8" onClick={onClose}>
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-6">
        {/* Preview Area */}
        <div
          className={cn(
            "group relative flex items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-inner",
            isText || isPDF ? "p-0" : "aspect-square"
          )}
        >
          {isImage ? (
            <img
              src={imageUrl}
              alt={item.name}
              className="max-h-full max-w-full object-contain drop-shadow-md"
            />
          ) : isText ? (
            <TextPreview url={previewUrl} />
          ) : isPDF || isDrive ? (
            <iframe
              src={previewUrl}
              className="h-64 w-full rounded-2xl border-0"
              title={item.name}
              allow="autoplay"
            />
          ) : (
            <FileIcon className="size-16 text-muted-foreground/40" />
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <div>
            <h4 className="mb-1 truncate text-sm font-bold">{item.name}</h4>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              {item.isDirectory ? "Klasör" : item.name.split(".").pop() + " File"}
            </p>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HardDriveIcon className="size-3.5" />
                <span>Size</span>
              </div>
              <span className="font-medium">
                {item.isDirectory ? "--" : formatSize(item.size)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarIcon className="size-3.5" />
                <span>Değiştirilme</span>
              </div>
              <span className="line-clamp-1 text-right font-medium">
                {format(new Date(item.updatedAt), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </div>
        </div>

        {!item.isDirectory && (
          <Button className="w-full gap-2 shadow-sm" asChild>
            <a href={downloadUrl} download={item.name}>
              <DownloadIcon className="size-4" />
              Dosyayı İndir
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}