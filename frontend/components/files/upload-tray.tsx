"use client"

import * as React from "react"
import { useUploadQueue, type UploadItem } from "@/contexts/upload-queue-context"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  AlertCircleIcon,
  PauseIcon,
  PlayIcon,
} from "lucide-react"

function formatEta(seconds: number): string {
  if (seconds < 60) return `~${seconds}s kaldı`
  if (seconds < 3600) return `~${Math.round(seconds / 60)}dk kaldı`
  return `~${(seconds / 3600).toFixed(1)}sa kaldı`
}

function ItemRow({
  item,
  retryItem,
  removeItem,
}: {
  item: UploadItem
  retryItem: (id: string) => void
  removeItem: (id: string) => void
}) {
  const fileName = item.file?.name ?? item.path.split("/").pop() ?? "dosya"

  const progressLabel = item.isChunked && item.chunksTotal
    ? `${item.progress}% (${item.chunksUploaded ?? 0}/${item.chunksTotal} parça)`
    : `${item.progress}%`

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs truncate">{fileName}</p>

        {item.status === "uploading" && (
          <>
            <Progress value={item.progress} className="h-1 mt-1" />
            <p className="text-xs text-muted-foreground mt-0.5">
              {progressLabel}
              {item.etaSeconds ? ` · ${formatEta(item.etaSeconds)}` : ""}
            </p>
          </>
        )}

        {item.status === "queued" && (
          <p className="text-xs text-muted-foreground">Sırada bekliyor…</p>
        )}

        {item.status === "error" && item.errorMessage && (
          <p className="text-xs text-destructive truncate" title={item.errorMessage}>
            {item.errorMessage}
          </p>
        )}
      </div>

      {item.status === "done" && (
        <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
      )}

      {item.status === "error" && item.file && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title="Yeniden dene"
          onClick={() => retryItem(item.id)}
        >
          <RefreshCwIcon className="h-3 w-3" />
        </Button>
      )}

      {(item.status === "done" || item.status === "error") && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          title="Kaldır"
          onClick={() => removeItem(item.id)}
        >
          <XIcon className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

export function UploadTray() {
  const { items, retryItem, retryAllFailed, pauseAll, resumeAll, isPaused, clearCompleted, removeItem } = useUploadQueue()
  const [minimized, setMinimized] = React.useState(false)

  if (items.length === 0) return null

  const done = items.filter((i) => i.status === "done").length
  const uploading = items.filter((i) => i.status === "uploading").length
  const queued = items.filter((i) => i.status === "queued").length
  const failed = items.filter((i) => i.status === "error").length
  const total = items.length
  const allTerminal = items.every((i) => i.status === "done" || i.status === "error")

  let headerLabel: string
  if (allTerminal) {
    headerLabel = `Tamamlandı (${done}/${total})`
  } else if (uploading > 0 && queued > 0) {
    headerLabel = `${uploading} yükleniyor, ${queued} bekliyor`
  } else if (uploading > 0) {
    headerLabel = `Yükleniyor (${done}/${total})`
  } else {
    headerLabel = `Hazırlanıyor…`
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium">{headerLabel}</span>
        <div className="flex gap-1">
          {!allTerminal && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              title={isPaused ? "Devam ettir" : "Tümünü duraklat"}
              onClick={isPaused ? resumeAll : pauseAll}
            >
              {isPaused ? (
                <PlayIcon className="h-3 w-3" />
              ) : (
                <PauseIcon className="h-3 w-3" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setMinimized((m) => !m)}
          >
            {minimized ? (
              <ChevronUpIcon className="h-3 w-3" />
            ) : (
              <ChevronDownIcon className="h-3 w-3" />
            )}
          </Button>
        </div>
      </div>

      {/* Error summary banner */}
      {!minimized && failed > 0 && (
        <div className="flex items-center justify-between gap-2 px-4 py-1.5 bg-destructive/10 border-b">
          <span className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircleIcon className="h-3 w-3" />
            {failed} dosya başarısız
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs px-2 text-destructive hover:text-destructive"
            onClick={retryAllFailed}
          >
            Hepsini yeniden dene
          </Button>
        </div>
      )}

      {/* Items */}
      {!minimized && (
        <div className="max-h-64 overflow-y-auto p-2 space-y-2">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              retryItem={retryItem}
              removeItem={removeItem}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {!minimized && allTerminal && (
        <div className="px-4 py-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={clearCompleted}
          >
            Tümünü temizle
          </Button>
        </div>
      )}
    </div>
  )
}
