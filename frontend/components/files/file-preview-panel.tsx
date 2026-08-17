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
import type { FileItem } from "@/components/files/file-utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { isImageFile, isTextFile, formatSize } from "./file-utils"
import { downloadFile } from "./file-utils"

interface FilePreviewPanelProps {
  item: FileItem | null
  onClose: () => void
}

function TextPreview({ url }: { url: string }) {
  const [content, setContent] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!url || url === "#") {
      setContent("Önizleme yüklenemedi.")
      setLoading(false)
      return
    }
    const controller = new AbortController()
    fetch(url, { signal: controller.signal })
      .then((res) => res.text())
      .then((text) => {
        setContent(text.length > 10240 ? text.slice(0, 10240) + "\n\n… (truncated)" : text)
        setLoading(false)
      })
      .catch((err) => {
        if (err.name === "AbortError") return
        setContent("Önizleme yüklenemedi.")
        setLoading(false)
      })
    return () => { controller.abort() }
  }, [url])

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-xs text-muted-foreground">
        Yükleniyor…
      </div>
    )
  }

  let display = content ?? ""
  if (url.toLowerCase().includes(".json") && content) {
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
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)

  React.useEffect(() => {
    setPreviewUrl(null)
    if (!item || item.type === "folder" || !item.id) return

    import("@/lib/actions/files")
      .then(({ getPreviewUrl }) => getPreviewUrl(item.id))
      .then(setPreviewUrl)
      .catch(() => setPreviewUrl(null))
  }, [item])

  if (!item) return null

  const isImage = isImageFile(item)
  const isText = isTextFile(item)
  const isPDF = /\.pdf$/i.test(item.name)
  const isFolder = item.type === "folder"

  const ext = (() => {
    const parts = item.name.split(".")
    return parts.length > 1 ? parts.pop()!.toUpperCase() : null
  })()

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
            isText || isPDF ? "p-0" : "aspect-square",
          )}
        >
          {isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt={item.name}
              className="max-h-full max-w-full object-contain drop-shadow-md"
            />
          ) : isText && previewUrl ? (
            <TextPreview url={previewUrl} />
          ) : isPDF && previewUrl ? (
            <iframe
              src={previewUrl}
              className="h-64 w-full rounded-2xl border-0"
              title={item.name}
              allow="autoplay"
            />
          ) : isFolder ? (
            <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10">
              <span className="text-5xl">📁</span>
            </div>
          ) : (
            <FileIcon className="size-16 text-muted-foreground/40" />
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <div>
            <h4 className="mb-1 truncate text-sm font-bold">{item.name}</h4>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              {isFolder ? "Klasör" : ext ? `${ext} Dosyası` : "Dosya"}
            </p>
          </div>

          <Separator className="bg-border/60" />

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <HardDriveIcon className="size-3.5" />
                <span>Boyut</span>
              </div>
              <span className="font-medium">
                {isFolder ? "--" : formatSize(item.size)}
              </span>
            </div>
            {item.lastModified && (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarIcon className="size-3.5" />
                  <span>Değiştirilme</span>
                </div>
                <span className="line-clamp-1 text-right font-medium">
                  {format(new Date(item.lastModified), "MMM d, yyyy HH:mm")}
                </span>
              </div>
            )}
          </div>
        </div>

        {!isFolder && item.id && (
          <Button
            className="w-full gap-2 shadow-sm"
            onClick={() => downloadFile(item)}
          >
            <DownloadIcon className="size-4" />
            Dosyayı İndir
          </Button>
        )}
      </div>
    </div>
  )
}