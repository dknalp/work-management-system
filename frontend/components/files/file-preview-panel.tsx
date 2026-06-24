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

interface FilePreviewPanelProps {
  item: FileItem | null
  onClose: () => void
}

export function FilePreviewPanel({ item, onClose }: FilePreviewPanelProps) {
  if (!item) return null

  const isImage = /\.(jpg|jpeg|png|svg|gif|webp)$/i.test(item.name)
  const isPDF = /\.pdf$/i.test(item.name)
  const isText = /\.(txt|md|json|js|ts|css|html)$/i.test(item.name)

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB", "TB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const previewUrl = `/api/files/raw?path=${encodeURIComponent(item.path)}`

  return (
    <div className="flex w-80 shrink-0 animate-in flex-col border-l border-border bg-card duration-300 slide-in-from-right">
      <div className="flex items-center justify-between border-b border-border p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <InfoIcon className="size-4 text-primary" />
          Details
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-6 overflow-y-auto p-6">
        {/* Preview Area */}
        <div className="group relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-inner">
          {isImage ? (
            <img
              src={previewUrl}
              alt={item.name}
              className="max-h-full max-w-full object-contain drop-shadow-md"
            />
          ) : (
            <FileIcon className="size-16 text-muted-foreground/40" />
          )}

          {isPDF && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 p-4 text-center backdrop-blur-sm">
              <FileIcon className="mb-3 size-12 text-rose-500" />
              <p className="px-4 text-xs font-medium">
                PDF Preview is handled via download or browser viewer.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-4 gap-2"
                asChild
              >
                <a href={previewUrl} target="_blank" rel="noreferrer">
                  Open PDF
                </a>
              </Button>
            </div>
          )}
        </div>

        {/* Metadata */}
        <div className="space-y-4">
          <div>
            <h4 className="mb-1 truncate text-sm font-bold">{item.name}</h4>
            <p className="text-[10px] font-medium tracking-wider text-muted-foreground uppercase">
              {item.isDirectory
                ? "Folder"
                : item.name.split(".").pop() + " File"}
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
                <span>Modified</span>
              </div>
              <span className="line-clamp-1 text-right font-medium">
                {format(new Date(item.updatedAt), "MMM d, yyyy HH:mm")}
              </span>
            </div>
          </div>
        </div>

        {!item.isDirectory && (
          <Button className="w-full gap-2 shadow-sm" asChild>
            <a href={previewUrl} download={item.name}>
              <DownloadIcon className="size-4" />
              Download File
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
