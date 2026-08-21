/**
 * DriveImportDialog — shows real-time progress while importing files or folders
 * from Google Drive into the workspace file system.
 *
 * For folder imports it connects to the SSE endpoint
 * `POST /api/v1/files/import-folder-stream` and streams per-file progress events.
 * For single-file imports it calls the existing `importFromDrive` action and
 * shows a simple spinner → result state.
 *
 * This component owns all import-side-effect logic so the parent (FileClientPage)
 * only needs to supply the picker result and react to `onComplete`.
 */

"use client"

import * as React from "react"
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Clock,
  Loader2,
  FolderOpen,
} from "lucide-react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { importFromDrive } from "@/lib/actions/files"
import { tokenStorage } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DriveImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Items selected from the Google Picker */
  items: Array<{ fileId: string; name: string; isFolder: boolean }>
  accessToken: string
  parentPath: string
  /** Called after all imports finish so the parent can refresh the file list */
  onComplete: () => void
}

/** Status of a single item in the import list */
type ItemStatus = "pending" | "importing" | "done" | "error" | "skipped"

interface ImportItem {
  fileId: string
  name: string
  isFolder: boolean
  status: ItemStatus
  /** Human-readable detail shown below the name (e.g. error message) */
  detail?: string
}

/** Possible events emitted by the SSE folder-import endpoint */
type SseEvent =
  | { type: "start"; total: number; folder: string }
  | { type: "progress"; done: number; total: number; name: string; skipped?: boolean; error?: boolean }
  | { type: "done"; imported: number; skipped: number; errors: string[] }
  | { type: "error"; message: string }

// ---------------------------------------------------------------------------
// Helper — status icon
// ---------------------------------------------------------------------------

/**
 * Returns the appropriate icon element for a given import status.
 * Uses semantic colors so status is clear at a glance.
 */
function StatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case "done":
      return <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
    case "error":
      return <XCircle className="h-4 w-4 shrink-0 text-destructive" />
    case "skipped":
      return <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
    case "importing":
      return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
    case "pending":
    default:
      return <Clock className="h-4 w-4 shrink-0 text-muted-foreground/60" />
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DriveImportDialog({
  open,
  onOpenChange,
  items,
  accessToken,
  parentPath,
  onComplete,
}: DriveImportDialogProps) {
  const [importItems, setImportItems] = React.useState<ImportItem[]>([])
  const [progress, setProgress] = React.useState(0)
  const [isImporting, setIsImporting] = React.useState(false)
  const [summary, setSummary] = React.useState<{
    imported: number
    skipped: number
    errors: number
  } | null>(null)
  const [fatalError, setFatalError] = React.useState<string | null>(null)
  const [folderName, setFolderName] = React.useState<string | null>(null)

  // Refs let the cancel handler abort an in-flight stream without stale closures
  const readerRef = React.useRef<ReadableStreamDefaultReader<Uint8Array> | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)

  // ------------------------------------------------------------------
  // Import orchestration — defined before the effect so no hoisting issue
  // ------------------------------------------------------------------

  /**
   * Updates the status (and optional detail message) of one item by index.
   * Wrapped in useCallback so it can be referenced inside the async helpers
   * without creating stale closures.
   */
  const updateItemStatus = React.useCallback(
    (index: number, status: ItemStatus, detail?: string) => {
      setImportItems((prev) => {
        const updated = [...prev]
        if (index < updated.length) {
          updated[index] = { ...updated[index], status, detail }
        }
        return updated
      })
    },
    []
  )

  /**
   * Imports a single non-folder file via the existing server action.
   * Returns `true` on success.
   *
   * @param fileId  - Google Drive file ID
   * @param index   - Position in importItems to update
   */
  const importSingleFile = React.useCallback(
    async (fileId: string, index: number): Promise<boolean> => {
      updateItemStatus(index, "importing")
      try {
        const record = await importFromDrive(fileId, accessToken, parentPath, false, false)
        if (record) {
          updateItemStatus(index, "done")
          return true
        }
        updateItemStatus(index, "error", "Import failed")
        return false
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error"
        updateItemStatus(index, "error", message)
        return false
      }
    },
    [accessToken, parentPath, updateItemStatus]
  )

  /**
   * Reads a Server-Sent Events stream and updates importItems in real time.
   * Returns the final tally once a "done" event is received or the stream ends.
   *
   * @param reader    - ReadableStream reader from the fetch response body
   * @param folderId  - ID of the folder item being imported (used to update its status)
   */
  const readSseStream = React.useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      folderId: string
    ): Promise<{ imported: number; skipped: number; errors: number }> => {
      const decoder = new TextDecoder()
      let buffer = ""
      let result = { imported: 0, skipped: 0, errors: 0 }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSE events are separated by double newlines
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? ""

        for (const part of parts) {
          const dataLine = part.split("\n").find((l) => l.startsWith("data:"))
          if (!dataLine) continue

          const json = dataLine.slice(5).trim()
          let event: SseEvent

          try {
            event = JSON.parse(json) as SseEvent
          } catch {
            continue // skip malformed event
          }

          if (event.type === "start") {
            setFolderName(event.folder)
            // Pre-populate placeholder rows for all expected sub-files
            const placeholders: ImportItem[] = Array.from(
              { length: event.total },
              (_, idx) => ({
                fileId: `${folderId}-sub-${idx}`,
                name: "…",
                isFolder: false,
                status: "pending" as ItemStatus,
              })
            )
            setImportItems((prev) => {
              const folderIndex = prev.findIndex((it) => it.fileId === folderId)
              if (folderIndex === -1) return [...prev, ...placeholders]
              return [
                ...prev.slice(0, folderIndex + 1),
                ...placeholders,
                ...prev.slice(folderIndex + 1),
              ]
            })
          } else if (event.type === "progress") {
            const subIndex = event.done - 1 // 0-based index of this file
            const status: ItemStatus = event.error
              ? "error"
              : event.skipped
              ? "skipped"
              : "done"

            setImportItems((prev) => {
              const folderIndex = prev.findIndex((it) => it.fileId === folderId)
              if (folderIndex === -1) return prev
              const updated = [...prev]
              const targetIndex = folderIndex + 1 + subIndex
              if (targetIndex < updated.length) {
                updated[targetIndex] = { ...updated[targetIndex], name: event.name, status }
              }
              return updated
            })

            setProgress(Math.round((event.done / event.total) * 100))
          } else if (event.type === "done") {
            result = {
              imported: event.imported,
              skipped: event.skipped,
              errors: event.errors.length,
            }
            setImportItems((prev) =>
              prev.map((it) => (it.fileId === folderId ? { ...it, status: "done" } : it))
            )
            setProgress(100)
          } else if (event.type === "error") {
            setFatalError(event.message)
            setImportItems((prev) =>
              prev.map((it) =>
                it.fileId === folderId
                  ? { ...it, status: "error", detail: event.message }
                  : it
              )
            )
          }
        }
      }

      return result
    },
    []
  )

  /**
   * Imports a Google Drive folder by opening an SSE stream to the backend.
   * Returns aggregated file counts for the final summary.
   *
   * @param folderId - Google Drive folder ID
   * @param name     - Folder display name (shown as dialog title)
   */
  const importFolderViaStream = React.useCallback(
    async (
      folderId: string,
      name: string
    ): Promise<{ imported: number; skipped: number; errors: number }> => {
      setFolderName(name)
      setImportItems((prev) =>
        prev.map((it) => (it.fileId === folderId ? { ...it, status: "importing" } : it))
      )

      const authToken = tokenStorage.getAccess()
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/files/import-folder-stream`,
          {
            method: "POST",
            signal: controller.signal,
            headers: {
              "Content-Type": "application/json",
              ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
            },
            body: JSON.stringify({
              folder_id: folderId,
              access_token: accessToken,
              parent_path: parentPath,
              overwrite: false,
            }),
          }
        )

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "Unknown error")
          throw new Error(`Server error ${response.status}: ${text}`)
        }

        const reader = response.body.getReader()
        readerRef.current = reader

        return await readSseStream(reader, folderId)
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setImportItems((prev) =>
            prev.map((it) =>
              it.fileId === folderId ? { ...it, status: "error", detail: "Cancelled" } : it
            )
          )
          return { imported: 0, skipped: 0, errors: 1 }
        }

        const message = err instanceof Error ? err.message : "Unknown error"
        setFatalError(message)
        setImportItems((prev) =>
          prev.map((it) =>
            it.fileId === folderId ? { ...it, status: "error", detail: message } : it
          )
        )
        return { imported: 0, skipped: 0, errors: 1 }
      } finally {
        readerRef.current = null
        abortRef.current = null
      }
    },
    [accessToken, parentPath, readSseStream]
  )

  /**
   * Top-level orchestrator — runs all selected items sequentially and
   * accumulates a final summary. Kicked off when the dialog opens.
   */
  const runImport = React.useCallback(
    async (
      selectedItems: Array<{ fileId: string; name: string; isFolder: boolean }>
    ) => {
      let totalImported = 0
      let totalSkipped = 0
      let totalErrors = 0

      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i]
        if (item.isFolder) {
          const res = await importFolderViaStream(item.fileId, item.name)
          totalImported += res.imported
          totalSkipped += res.skipped
          totalErrors += res.errors
        } else {
          const success = await importSingleFile(item.fileId, i)
          if (success) totalImported++
          else totalErrors++
        }
      }

      setSummary({ imported: totalImported, skipped: totalSkipped, errors: totalErrors })
      setProgress(100)
      setIsImporting(false)
      onComplete()
    },
    [importFolderViaStream, importSingleFile, onComplete]
  )

  // ------------------------------------------------------------------
  // Start import when dialog opens — all state resets happen inside an
  // async callback to avoid synchronous setState in the effect body
  // (which triggers the react-hooks/set-state-in-effect lint rule).
  // ------------------------------------------------------------------

  React.useEffect(() => {
    if (!open || items.length === 0) return

    // Kick off the import asynchronously so state updates happen inside
    // the async function rather than synchronously in the effect body.
    const start = async () => {
      setImportItems(
        items.map((item) => ({
          fileId: item.fileId,
          name: item.name,
          isFolder: item.isFolder,
          status: "pending" as ItemStatus,
        }))
      )
      setProgress(0)
      setSummary(null)
      setFatalError(null)
      setFolderName(null)
      setIsImporting(true)
      await runImport(items)
    }

    void start()
  }, [open, items, runImport])

  // Cleanup on unmount — abort any in-flight stream
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort()
      readerRef.current?.cancel()
    }
  }, [])

  // ------------------------------------------------------------------
  // Cancel handler
  // ------------------------------------------------------------------

  /** Aborts the SSE connection and marks the import as no longer running. */
  function handleCancel() {
    abortRef.current?.abort()
    readerRef.current?.cancel()
    setIsImporting(false)
    toast.info("Import cancelled")
  }

  // ------------------------------------------------------------------
  // Derived display values
  // ------------------------------------------------------------------

  const doneCount = importItems.filter((it) => it.status === "done").length
  const totalCount = importItems.length
  const dialogTitle = folderName
    ? `Importing: ${folderName}`
    : items.length === 1
    ? `Importing: ${items[0]?.name ?? "file"}`
    : `Importing ${items.length} items`

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <Dialog
      open={open}
      onOpenChange={isImporting ? undefined : onOpenChange}
    >
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => {
          if (isImporting) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            {dialogTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Progress bar with file count */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                {isImporting ? "Importing…" : summary ? "Complete" : "Starting…"}
              </span>
              <span>
                {doneCount} / {totalCount}
              </span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {/* Fatal error banner */}
          {fatalError && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {fatalError}
            </p>
          )}

          {/* Scrollable per-file status list */}
          {importItems.length > 0 && (
            <ScrollArea className="h-56 rounded-md border">
              <ul className="divide-y divide-border">
                {importItems.map((item) => (
                  <li
                    key={item.fileId}
                    className="flex items-start gap-3 px-3 py-2"
                  >
                    <span className="mt-0.5">
                      <StatusIcon status={item.status} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`truncate text-sm ${
                          item.status === "error"
                            ? "text-destructive"
                            : item.status === "skipped"
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {item.name}
                      </p>
                      {item.detail && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {item.detail}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}

          {/* Summary shown after all items complete */}
          {summary && (
            <div className="rounded-md bg-muted px-3 py-2 text-sm">
              <span className="text-green-600 dark:text-green-400">
                {summary.imported} imported
              </span>
              {summary.skipped > 0 && (
                <>
                  {" · "}
                  <span className="text-muted-foreground">
                    {summary.skipped} skipped
                  </span>
                </>
              )}
              {summary.errors > 0 && (
                <>
                  {" · "}
                  <span className="text-destructive">
                    {summary.errors} errors
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {isImporting && (
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            disabled={isImporting}
            onClick={() => onOpenChange(false)}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              "Close"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}