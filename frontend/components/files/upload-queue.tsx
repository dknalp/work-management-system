"use client"

/**
 * upload-queue.tsx — thin wrapper around @/contexts/upload-queue-context.
 *
 * All upload logic (chunked upload, queue engine, retry, debounced refresh)
 * lives in @/contexts/upload-queue-context.  This file re-exports the context
 * surface so existing consumers (file-explorer, file-toolbar, file-drop-zone)
 * keep their import paths unchanged, and provides the UploadQueueProvider
 * that mounts the context + floating UploadTray together.
 */

import * as React from "react"

// Re-export context surface — consumers import from here and nothing changes
export {
  UploadQueueContext,
  useUploadQueue,
  type UploadItem,
  type FileRecord,
  type UploadQueueContextType,
} from "@/contexts/upload-queue-context"

import { UploadQueueProvider as _UploadQueueProvider } from "@/contexts/upload-queue-context"
import { UploadTray } from "@/components/files/upload-tray"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// ---------------------------------------------------------------------------
// Duplicate-file dialog (shown when server returns 409 Conflict)
// ---------------------------------------------------------------------------

export function DuplicateDialog({
  fileName,
  path,
  onAction,
}: {
  fileName: string
  path: string
  onAction: (action: "overwrite" | "rename" | "skip") => void
}) {
  return (
    <Dialog open>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Duplicate File</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{fileName}</span> already exists
            {path ? ` in "${path}"` : ""}. What would you like to do?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="destructive" size="sm" onClick={() => onAction("overwrite")}>
            Overwrite
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAction("rename")}>
            Auto-rename
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAction("skip")}>
            Skip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// UploadQueueProvider — mounts context + tray
// ---------------------------------------------------------------------------

/**
 * Mount once around the file explorer. Provides the upload queue context
 * to all children and renders the floating UploadTray.
 */
export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  return (
    <_UploadQueueProvider>
      {children}
      <UploadTray />
    </_UploadQueueProvider>
  )
}
