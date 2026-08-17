"use client"

import * as React from "react"
import { useUploadQueue } from "@/contexts/upload-queue-context"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import {
  CheckIcon,
  XIcon,
  RefreshCwIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react"

export function UploadTray() {
  const { items, retryItem, clearCompleted, removeItem } = useUploadQueue()
  const [minimized, setMinimized] = React.useState(false)

  if (items.length === 0) return null

  const done = items.filter((i) => i.status === "done").length
  const total = items.length
  const allDone = items.every(
    (i) => i.status === "done" || i.status === "error",
  )

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="text-sm font-medium">
          {allDone
            ? `Tamamlandı (${done}/${total})`
            : `Yükleniyor (${done}/${total})`}
        </span>
        <div className="flex gap-1">
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

      {/* Items */}
      {!minimized && (
        <div className="max-h-64 overflow-y-auto p-2 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{item.file.name}</p>
                {item.status === "uploading" && (
                  <Progress value={item.progress} className="h-1 mt-1" />
                )}
                {item.status === "error" && (
                  <p className="text-xs text-destructive">
                    {item.errorMessage}
                  </p>
                )}
              </div>
              {item.status === "done" && (
                <CheckIcon className="h-4 w-4 text-green-500 shrink-0" />
              )}
              {item.status === "error" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
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
                  onClick={() => removeItem(item.id)}
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      {!minimized && allDone && (
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