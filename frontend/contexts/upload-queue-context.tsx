"use client"

import * as React from "react"
import { tokenStorage } from "@/lib/auth"

// For uploads we bypass the Next.js proxy (which has a hard body-size limit)
// and go directly to the backend. NEXT_PUBLIC_UPLOAD_URL is set to the backend
// host URL in docker-compose; falls back to NEXT_PUBLIC_API_URL for local dev.
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_UPLOAD_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
).replace(/\/+$/, "")

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3
const MAX_AUTO_RETRIES = 3
const CHUNK_SIZE = 5 * 1024 * 1024          // 5 MiB — matches backend CHUNK_SIZE
const CHUNKED_THRESHOLD = 100 * 1024 * 1024 // 100 MiB — matches backend MAX_SINGLE_REQUEST_BYTES
const XHR_TIMEOUT_MS = 10 * 60 * 1000       // 10 min per file/chunk
const REFRESH_DEBOUNCE_MS = 500             // fire wms:files:changed once after last completion
const SESSION_STORAGE_KEY = "wms:upload-queue"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileRecord {
  id?: string
  name: string
  path: string
  size: number
  mime_type?: string
  created_at?: string
  is_deleted?: boolean
}

export interface UploadItem {
  id: string
  file: File | null            // null after page refresh (File objects are not serializable)
  path: string
  status: "queued" | "uploading" | "done" | "error"
  progress: number             // 0–100 overall
  errorMessage?: string
  retryCount: number           // auto-retry attempts so far
  isChunked: boolean           // true if file >= CHUNKED_THRESHOLD
  // chunked-only
  uploadSessionId?: string
  chunksTotal?: number
  chunksUploaded?: number
  bytesPerSec?: number
  etaSeconds?: number
  result?: FileRecord
}

interface UploadQueueContextType {
  items: UploadItem[]
  addFiles: (files: File[], path: string) => void
  addFilesWithPaths: (entries: { file: File; path: string }[]) => void
  retryItem: (id: string) => void
  retryAllFailed: () => void
  pauseAll: () => void
  resumeAll: () => void
  isPaused: boolean
  clearCompleted: () => void
  removeItem: (id: string) => void
}

export const UploadQueueContext = React.createContext<UploadQueueContextType>({
  items: [],
  addFiles: () => {},
  addFilesWithPaths: () => {},
  retryItem: () => {},
  retryAllFailed: () => {},
  pauseAll: () => {},
  resumeAll: () => {},
  isPaused: false,
  clearCompleted: () => {},
  removeItem: () => {},
})

// ---------------------------------------------------------------------------
// Simple (single-request) upload via XHR
// ---------------------------------------------------------------------------

function uploadWithXHR(
  item: UploadItem,
  onProgress: (p: number) => void,
  onDone: (result: FileRecord) => void,
  onError: (msg: string, retryable: boolean) => void,
): XMLHttpRequest {
  const xhr = new XMLHttpRequest()
  const form = new FormData()
  form.append("file", item.file as File)
  form.append("path", item.path)
  form.append("overwrite", "false")

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
  }
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        onDone(JSON.parse(xhr.responseText) as FileRecord)
      } catch {
        onError("Invalid response from server", false)
      }
    } else {
      // 4xx errors are not retryable (bad request, auth, quota, etc.)
      const retryable = xhr.status >= 500
      try {
        const body = JSON.parse(xhr.responseText) as { detail?: string }
        onError(body?.detail || `Upload failed (HTTP ${xhr.status})`, retryable)
      } catch {
        onError(`Upload failed (HTTP ${xhr.status})`, retryable)
      }
    }
  }
  xhr.onerror = () => onError("Network error — check your connection", true)
  xhr.onabort = () => onError("Upload aborted", false)
  xhr.ontimeout = () => onError(`Upload timed out after ${XHR_TIMEOUT_MS / 60000} minutes`, true)

  xhr.timeout = XHR_TIMEOUT_MS
  xhr.open("POST", `${API_BASE_URL}/api/v1/files/upload`)
  const token = tokenStorage.getAccess()
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
  xhr.send(form)
  return xhr
}

// ---------------------------------------------------------------------------
// Chunked upload helpers
// ---------------------------------------------------------------------------

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.getAccess()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> | undefined),
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { detail?: string }
    throw new Error(body?.detail || `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

async function uploadChunkXHR(
  uploadSessionId: string,
  chunkIndex: number,
  chunkBlob: Blob,
  onProgress: (loaded: number, total: number) => void,
): Promise<{ chunk_index: number; received: boolean; chunks_received: number; total_chunks: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append("chunk_index", String(chunkIndex))
    form.append("chunk_data", chunkBlob, `chunk-${chunkIndex}`)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded, e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText))
      } else {
        const retryable = xhr.status >= 500
        try {
          const body = JSON.parse(xhr.responseText) as { detail?: string }
          const err = new Error(body?.detail || `HTTP ${xhr.status}`) as Error & { retryable: boolean }
          err.retryable = retryable
          reject(err)
        } catch {
          const err = new Error(`HTTP ${xhr.status}`) as Error & { retryable: boolean }
          err.retryable = retryable
          reject(err)
        }
      }
    }
    xhr.onerror = () => {
      const err = new Error("Network error") as Error & { retryable: boolean }
      err.retryable = true
      reject(err)
    }
    xhr.ontimeout = () => {
      const err = new Error(`Chunk upload timed out`) as Error & { retryable: boolean }
      err.retryable = true
      reject(err)
    }
    xhr.timeout = XHR_TIMEOUT_MS

    xhr.open("PUT", `${API_BASE_URL}/api/v1/files/upload/chunk/${uploadSessionId}`)
    const token = tokenStorage.getAccess()
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.send(form)
  })
}

async function runChunkedUpload(
  item: UploadItem,
  onProgress: (progress: number, chunksUploaded: number, chunksTotal: number, bytesPerSec?: number) => void,
  onDone: (result: FileRecord) => void,
  onError: (msg: string, retryable: boolean) => void,
): Promise<void> {
  const file = item.file as File
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
  let uploadSessionId: string | undefined

  try {
    // 1. Init session
    const init = await apiJson<{ upload_id: string; chunk_size: number }>(
      "/api/v1/files/upload/init",
      {
        method: "POST",
        body: JSON.stringify({
          filename: file.name,
          path: item.path,
          total_size: file.size,
          total_chunks: totalChunks,
          mime_type: file.type || "application/octet-stream",
        }),
      },
    )
    uploadSessionId = init.upload_id

    // 2. Upload chunks sequentially — safe for append-mode on local disk backend
    let chunksUploaded = 0
    const startTime = Date.now()

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const blob = file.slice(start, start + CHUNK_SIZE)
      let chunkAttempt = 0
      let chunkDone = false

      while (!chunkDone) {
        try {
          await uploadChunkXHR(uploadSessionId, i, blob, (loaded, total) => {
            // Per-chunk progress within this chunk
            const chunkFraction = loaded / total
            const overallProgress = Math.round(((chunksUploaded + chunkFraction) / totalChunks) * 100)
            const elapsed = (Date.now() - startTime) / 1000
            const bytesUploaded = chunksUploaded * CHUNK_SIZE + loaded
            const bytesPerSec = elapsed > 0 ? bytesUploaded / elapsed : undefined
            onProgress(overallProgress, chunksUploaded, totalChunks, bytesPerSec)
          })
          chunksUploaded++
          chunkDone = true
          const elapsed = (Date.now() - startTime) / 1000
          const bytesUploaded = chunksUploaded * CHUNK_SIZE
          const bytesPerSec = elapsed > 0 ? bytesUploaded / elapsed : undefined
          onProgress(
            Math.round((chunksUploaded / totalChunks) * 100),
            chunksUploaded,
            totalChunks,
            bytesPerSec,
          )
        } catch (err) {
          const e = err as Error & { retryable?: boolean }
          chunkAttempt++
          if (e.retryable && chunkAttempt <= MAX_AUTO_RETRIES) {
            const delay = 1000 * Math.pow(2, chunkAttempt - 1)
            await new Promise((r) => setTimeout(r, delay))
          } else {
            throw e
          }
        }
      }
    }

    // 3. Complete
    const result = await apiJson<FileRecord>(
      `/api/v1/files/upload/complete/${uploadSessionId}`,
      { method: "POST" },
    )
    onDone(result)
  } catch (err) {
    const e = err as Error & { retryable?: boolean }
    // Abort the session to free R2 storage
    if (uploadSessionId) {
      apiJson(`/api/v1/files/upload/abort/${uploadSessionId}`, { method: "DELETE" }).catch(() => {})
    }
    onError(e.message || "Chunked upload failed", e.retryable ?? true)
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<UploadItem[]>([])
  const [isPaused, setIsPaused] = React.useState(false)
  const activeCount = React.useRef(0)
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced file-list refresh — fires once after the last completion
  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      window.dispatchEvent(new Event("wms:files:changed"))
      refreshTimer.current = null
    }, REFRESH_DEBOUNCE_MS)
  }, [])

  // ---------------------------------------------------------------------------
  // SessionStorage persistence (survives page refresh)
  // ---------------------------------------------------------------------------

  // Restore on mount — File objects are gone, so interrupted items become "error"
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Omit<UploadItem, "file">[]
      const restored: UploadItem[] = saved.map((it) => ({
        ...it,
        file: null,
        // Items that were uploading can't resume — File object is gone
        status: it.status === "uploading" || it.status === "queued"
          ? "error"
          : it.status,
        errorMessage:
          it.status === "uploading" || it.status === "queued"
            ? "Upload interrupted — re-add the file to retry"
            : it.errorMessage,
      }))
      if (restored.length > 0) setItems(restored)
    } catch {
      // Corrupt storage — ignore
    }
  }, [])

  // Persist on every change (omit File blob — not serializable)
  React.useEffect(() => {
    try {
      const serializable = items.map(({ file: _file, ...rest }) => rest)
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializable))
    } catch {
      // Storage full or unavailable — ignore
    }
  }, [items])

  // ---------------------------------------------------------------------------
  // Item updater
  // ---------------------------------------------------------------------------

  const updateItem = React.useCallback((id: string, patch: Partial<UploadItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)))
  }, [])

  // ---------------------------------------------------------------------------
  // Upload execution
  // ---------------------------------------------------------------------------

  const startUpload = React.useCallback(
    (item: UploadItem) => {
      if (!item.file) {
        updateItem(item.id, {
          status: "error",
          errorMessage: "File not available — re-add to retry",
        })
        return
      }

      activeCount.current++
      updateItem(item.id, { status: "uploading", progress: 0 })

      const onDone = (result: FileRecord) => {
        activeCount.current--
        updateItem(item.id, { status: "done", progress: 100, result })
        // Only refresh the file list when the queue drains — not after every
        // single completion. Firing on each completion unmounts the explorer
        // (loading skeleton replaces it) and kills remaining in-flight uploads.
        if (activeCount.current === 0) {
          scheduleRefresh()
        }
      }

      const onError = (msg: string, retryable: boolean) => {
        activeCount.current--
        const nextRetry = item.retryCount + 1
        if (retryable && item.retryCount < MAX_AUTO_RETRIES) {
          const delay = 1000 * Math.pow(2, item.retryCount) // 1s, 2s, 4s
          setTimeout(() => {
            updateItem(item.id, {
              status: "queued",
              retryCount: nextRetry,
              errorMessage: `Retrying (attempt ${nextRetry}/${MAX_AUTO_RETRIES})…`,
            })
          }, delay)
        } else {
          updateItem(item.id, { status: "error", errorMessage: msg })
        }
      }

      if (item.isChunked) {
        runChunkedUpload(
          item,
          (progress, chunksUploaded, chunksTotal, bytesPerSec) => {
            const etaSeconds =
              bytesPerSec && bytesPerSec > 0
                ? Math.round(((chunksTotal - chunksUploaded) * CHUNK_SIZE) / bytesPerSec)
                : undefined
            updateItem(item.id, { progress, chunksUploaded, chunksTotal, bytesPerSec, etaSeconds })
          },
          onDone,
          onError,
        )
      } else {
        uploadWithXHR(
          item,
          (progress) => updateItem(item.id, { progress }),
          onDone,
          onError,
        )
      }
    },
    [updateItem, scheduleRefresh],
  )

  // Drain queue whenever items change
  React.useEffect(() => {
    const slots = MAX_CONCURRENT - activeCount.current
    if (slots <= 0) return
    const queued = items.filter((i) => i.status === "queued" && i.file !== null)
    queued.slice(0, slots).forEach((item) => startUpload(item))
  }, [items, startUpload])

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const addFilesWithPaths = React.useCallback(
    (entries: { file: File; path: string }[]) => {
      const newItems: UploadItem[] = entries.map(({ file, path }) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        path,
        status: "queued",
        progress: 0,
        retryCount: 0,
        isChunked: file.size >= CHUNKED_THRESHOLD,
      }))
      setItems((prev) => [...prev, ...newItems])
    },
    [],
  )

  const addFiles = React.useCallback(
    (files: File[], path: string) => {
      addFilesWithPaths(files.map((file) => ({ file, path })))
    },
    [addFilesWithPaths],
  )

  const retryItem = React.useCallback((id: string) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, status: "queued", progress: 0, errorMessage: undefined, retryCount: 0 }
          : i,
      ),
    )
  }, [])

  const pauseAll = React.useCallback(() => {
    setIsPaused(true)
  }, [])

  const resumeAll = React.useCallback(() => {
    setIsPaused(false)
  }, [])

  const retryAllFailed = React.useCallback(() => {
    setItems((prev) =>
      prev.map((i) =>
        i.status === "error" && i.file !== null
          ? { ...i, status: "queued", progress: 0, errorMessage: undefined, retryCount: 0 }
          : i,
      ),
    )
  }, [])

  const clearCompleted = React.useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status !== "done" && i.status !== "error"))
  }, [])

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return (
    <UploadQueueContext.Provider
      value={{ items, addFiles, addFilesWithPaths, retryItem, retryAllFailed, pauseAll, resumeAll, isPaused, clearCompleted, removeItem }}
    >
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue() {
  return React.useContext(UploadQueueContext)
}
