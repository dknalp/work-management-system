"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  X,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { tokenStorage } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileRecord {
  name: string
  path: string
  size: number
  mime_type?: string
  created_at?: string
}

export interface UploadItem {
  id: string
  file: File
  path: string
  status: "pending" | "uploading" | "done" | "error"
  progress: number
  errorMessage?: string
  result?: FileRecord
}

interface DuplicateCandidate {
  file: File
  path: string
  resolve: (action: "overwrite" | "rename" | "skip") => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface UploadQueueContextType {
  items: UploadItem[]
  addFiles: (files: File[], path: string) => void
  retryItem: (id: string) => void
  clearCompleted: () => void
  removeItem: (id: string) => void
}

export const UploadQueueContext = createContext<UploadQueueContextType>({
  items: [],
  addFiles: () => {},
  retryItem: () => {},
  clearCompleted: () => {},
  removeItem: () => {},
})

export function useUploadQueue() {
  return useContext(UploadQueueContext)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3

// XHR upload always uses a relative URL so the request goes through the
// Next.js rewrite proxy (/api/* → backend:3052).  Never use NEXT_PUBLIC_API_URL
// here: that env var points directly at the backend port which is unreachable
// from the browser in Docker (only the frontend port is exposed), causing
// ERR_ACCESS_DENIED.  All other fetch/apiClient calls in the app already use
// relative paths for the same reason.
const API_BASE_URL = ""

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function addSuffix(name: string, suffix: number): string {
  const dotIdx = name.lastIndexOf(".")
  if (dotIdx === -1) return `${name} (${suffix})`
  return `${name.slice(0, dotIdx)} (${suffix})${name.slice(dotIdx)}`
}

function uploadWithXHR(
  item: UploadItem,
  overwrite: boolean,
  onProgress: (p: number) => void
): Promise<FileRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append("file", item.file)
    form.append("path", item.path)
    form.append("overwrite", String(overwrite))

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as FileRecord)
        } catch {
          resolve({ name: item.file.name, path: item.path, size: item.file.size })
        }
      } else {
        try {
          const body = JSON.parse(xhr.responseText) as { detail?: string }
          reject(new Error(body?.detail ?? `HTTP ${xhr.status}`))
        } catch {
          reject(new Error(`HTTP ${xhr.status}`))
        }
      }
    }

    xhr.onerror = (e) => {
      console.error("[upload] XHR onerror", {
        readyState: xhr.readyState,
        status: xhr.status,
        responseText: xhr.responseText,
        event: e,
      })
      reject(new Error("Network error"))
    }
    xhr.ontimeout = () => reject(new Error("Upload timed out"))

    const uploadUrl = `${API_BASE_URL}/api/v1/files/upload`
    console.log("[upload] open XHR →", uploadUrl)
    console.log("[upload] file:", item.file.name, item.file.size, "bytes, type:", item.file.type)
    xhr.open("POST", uploadUrl)
    const token = tokenStorage.getAccess()
    console.log("[upload] token present:", !!token, token ? token.slice(0, 20) + "..." : "NONE")
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    console.log("[upload] sending form...")
    xhr.send(form)
    console.log("[upload] sent, readyState:", xhr.readyState)
  })
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<UploadItem[]>([])
  const [duplicate, setDuplicate] = useState<DuplicateCandidate | null>(null)

  // Refs — avoid stale closure issues
  const activeCount = useRef(0)
  const overwriteSet = useRef<Set<string>>(new Set())
  const itemsRef = useRef<UploadItem[]>([])
  const askDuplicateRef = useRef<(file: File, path: string) => Promise<"overwrite" | "rename" | "skip">>(() => Promise.resolve("skip" as const))

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  // -------------------------------------------------------------------------
  // startItem / drainQueue
  //
  // uploadFn is a module-level stable ref so it never triggers
  // "Cannot access before declaration" and is never read during render.
  // -------------------------------------------------------------------------

  const drainQueue = useCallback(() => {
    // Read from itemsRef (kept in sync by useEffect) instead of calling
    // uploadFnRef inside a setItems updater.  Running side-effects inside a
    // state-updater function is an anti-pattern: React 18 StrictMode invokes
    // updaters twice in development, which double-starts uploads and causes
    // activeCount to permanently desync.
    const pending = itemsRef.current.filter((i) => i.status === "pending")
    const slots = MAX_CONCURRENT - activeCount.current
    pending.slice(0, slots).forEach((item) => uploadFnRef.current(item))
  }, [])

  // Keep drainQueue accessible to the upload fn
  const drainQueueRef = useRef(drainQueue)
  useEffect(() => { drainQueueRef.current = drainQueue }, [drainQueue])

  // uploadFnRef holds the real implementation — assigned once, stable identity
  const uploadFnRef = useRef((item: UploadItem) => {
    const overwrite = overwriteSet.current.has(item.id)
    if (overwrite) overwriteSet.current.delete(item.id)

    activeCount.current += 1

    // Helper: update both itemsRef and React state together so drainQueue
    // always reads a consistent snapshot regardless of React commit timing.
    const patchItem = (patch: Partial<UploadItem>) => {
      itemsRef.current = itemsRef.current.map((i) =>
        i.id === item.id ? { ...i, ...patch } : i
      )
      setItems(itemsRef.current)
    }

    patchItem({ status: "uploading", progress: 0 })

    uploadWithXHR(item, overwrite, (progress) => {
      patchItem({ progress })
    })
      .then((result) => {
        patchItem({ status: "done", progress: 100, result })
        window.dispatchEvent(new Event("wms:files:changed"))
      })
      .catch(async (err: unknown) => {
        const message = err instanceof Error ? err.message : "Unknown error"

        // Server-side 409: file already exists — ask user what to do, same as
        // in-memory collision handling in addFiles.
        if (message.startsWith("A file named") || message.includes("already exists")) {
          patchItem({ status: "pending", progress: 0, errorMessage: undefined })
          const action = await askDuplicateRef.current(item.file, item.path)
          if (action === "skip") {
            patchItem({ status: "error", errorMessage: "Atlandı" })
          } else if (action === "overwrite") {
            overwriteSet.current.add(item.id)
            patchItem({ status: "pending", progress: 0, errorMessage: undefined })
          } else {
            // rename: add suffix and re-queue
            let suffix = 1
            let newName = addSuffix(item.file.name, suffix)
            while (itemsRef.current.find((i) => i.file.name === newName && i.path === item.path && i.status !== "error")) {
              suffix++
              newName = addSuffix(item.file.name, suffix)
            }
            const renamedFile = new File([item.file], newName, { type: item.file.type })
            itemsRef.current = itemsRef.current.map((i) =>
              i.id === item.id ? { ...i, file: renamedFile, status: "pending", progress: 0, errorMessage: undefined } : i
            )
            setItems(itemsRef.current)
          }
          return
        }

        patchItem({ status: "error", errorMessage: message })
      })
      .finally(() => {
        activeCount.current -= 1
        drainQueueRef.current()
      })
  })

  // -------------------------------------------------------------------------
  // Duplicate dialog helper
  // -------------------------------------------------------------------------

  const askDuplicate = useCallback(
    (file: File, path: string): Promise<"overwrite" | "rename" | "skip"> =>
      new Promise((resolve) => {
        setDuplicate({ file, path, resolve })
      }),
    []
  )
  // Keep ref in sync so async upload callbacks can always access the latest version
  askDuplicateRef.current = askDuplicate

  // -------------------------------------------------------------------------
  // addFiles — public API
  // -------------------------------------------------------------------------

  const addFiles = useCallback(
    async (files: File[], path: string) => {
      const newItems: UploadItem[] = []

      for (const file of files) {
        const collision = itemsRef.current.find(
          (i) =>
            i.file.name === file.name &&
            i.path === path &&
            i.status !== "error"
        )

        let resolvedFile = file
        const resolvedPath = path
        let overwrite = false

        if (collision) {
          const action = await askDuplicate(file, path)
          if (action === "skip") continue
          if (action === "overwrite") {
            overwrite = true
          } else {
            // rename: suffix until no collision
            let suffix = 1
            let newName = addSuffix(file.name, suffix)
            while (
              itemsRef.current.find(
                (i) => i.file.name === newName && i.path === resolvedPath
              )
            ) {
              suffix++
              newName = addSuffix(file.name, suffix)
            }
            resolvedFile = new File([file], newName, { type: file.type })
          }
        }

        const item: UploadItem = {
          id: generateId(),
          file: resolvedFile,
          path: resolvedPath,
          status: "pending",
          progress: 0,
        }

        if (overwrite) overwriteSet.current.add(item.id)
        newItems.push(item)
      }

      if (newItems.length === 0) return

      // Update itemsRef synchronously so drainQueue sees the new items
      // immediately, even before React commits the setItems update.
      itemsRef.current = [...itemsRef.current, ...newItems]
      setItems(itemsRef.current)
      drainQueue()
    },
    [askDuplicate, drainQueue]
  )

  // -------------------------------------------------------------------------
  // retryItem
  // -------------------------------------------------------------------------

  const retryItem = useCallback(
    (id: string) => {
      // Update itemsRef synchronously so drainQueue sees the reset item.
      itemsRef.current = itemsRef.current.map((i) =>
        i.id === id
          ? { ...i, status: "pending" as const, progress: 0, errorMessage: undefined }
          : i
      )
      setItems(itemsRef.current)
      drainQueue()
    },
    [drainQueue]
  )

  // -------------------------------------------------------------------------
  // clearCompleted / removeItem
  // -------------------------------------------------------------------------

  const clearCompleted = useCallback(
    () => setItems((prev) => prev.filter((i) => i.status !== "done")),
    []
  )

  const removeItem = useCallback(
    (id: string) => setItems((prev) => prev.filter((i) => i.id !== id)),
    []
  )

  // -------------------------------------------------------------------------
  // Duplicate dialog handlers
  // -------------------------------------------------------------------------

  const handleDuplicateAction = (action: "overwrite" | "rename" | "skip") => {
    if (duplicate) {
      duplicate.resolve(action)
      setDuplicate(null)
    }
  }

  return (
    <UploadQueueContext.Provider
      value={{ items, addFiles, retryItem, clearCompleted, removeItem }}
    >
      {children}
      <UploadTray />
      {duplicate && (
        <DuplicateDialog
          fileName={duplicate.file.name}
          path={duplicate.path}
          onAction={handleDuplicateAction}
        />
      )}
    </UploadQueueContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Duplicate Dialog
// ---------------------------------------------------------------------------

function DuplicateDialog({
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
          <Button
            variant="destructive"
            size="sm"
            onClick={() => onAction("overwrite")}
          >
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
// Upload Tray
// ---------------------------------------------------------------------------

function UploadTray() {
  const { items, retryItem, clearCompleted, removeItem } = useUploadQueue()
  const [minimized, setMinimized] = useState(false)
  const autoCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const total = items.length
  const doneCount = items.filter((i) => i.status === "done").length
  const errorCount = items.filter((i) => i.status === "error").length
  const uploadingCount = items.filter((i) => i.status === "uploading").length
  const pendingCount = items.filter((i) => i.status === "pending").length
  const allFinished = total > 0 && uploadingCount === 0 && pendingCount === 0

  // Derive visibility from items — no extra state that needs an effect
  const visible = total > 0

  // Auto-close 5s after everything succeeds
  useEffect(() => {
    if (autoCloseTimer.current) {
      clearTimeout(autoCloseTimer.current)
      autoCloseTimer.current = null
    }
    if (allFinished && errorCount === 0) {
      autoCloseTimer.current = setTimeout(() => {
        clearCompleted()
      }, 5000)
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    }
  }, [allFinished, errorCount, clearCompleted])

  if (!visible) return null

  const headerLabel = allFinished
    ? `Done (${doneCount}/${total})`
    : `Uploading (${doneCount + errorCount}/${total})`

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-background shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">{headerLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setMinimized((v) => !v)}
            aria-label={minimized ? "Expand" : "Minimize"}
          >
            {minimized ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => clearCompleted()}
            aria-label="Close"
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Item list */}
      {!minimized && (
        <div className="max-h-72 overflow-y-auto divide-y divide-border">
          {items.map((item) => (
            <TrayItem
              key={item.id}
              item={item}
              onRetry={retryItem}
              onRemove={removeItem}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      {!minimized && doneCount > 0 && (
        <div className="px-3 py-2 border-t border-border flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs h-7 text-muted-foreground hover:text-foreground"
            onClick={clearCompleted}
          >
            Clear completed
          </Button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tray Item
// ---------------------------------------------------------------------------

function TrayItem({
  item,
  onRetry,
  onRemove,
}: {
  item: UploadItem
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}) {
  const statusIcon = {
    pending: <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />,
    uploading: <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />,
    done: <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />,
    error: <XCircle className="w-3.5 h-3.5 text-destructive" />,
  }[item.status]

  return (
    <div className="px-3 py-2.5 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0">{statusIcon}</span>
        <span className="truncate text-xs text-foreground flex-1 min-w-0">
          {item.file.name}
        </span>
        {item.status === "error" && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onRetry(item.id)}
            title="Retry"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        )}
        {(item.status === "done" || item.status === "error") && (
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(item.id)}
            title="Remove"
          >
            <X className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Progress bar */}
      {(item.status === "uploading" || item.status === "pending") && (
        <Progress
          value={item.status === "pending" ? 0 : item.progress}
          className="h-1"
        />
      )}
      {item.status === "uploading" && (
        <span className="text-[10px] text-muted-foreground">{item.progress}%</span>
      )}

      {/* Error message */}
      {item.status === "error" && item.errorMessage && (
        <span className="text-[10px] text-destructive truncate">
          {item.errorMessage}
        </span>
      )}
    </div>
  )
}