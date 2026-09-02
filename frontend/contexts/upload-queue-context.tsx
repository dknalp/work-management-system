"use client"

/**
 * Upload queue context — handles single-file XHR and chunked uploads.
 *
 * Performance design for 1500+ files:
 * - Items stored in a Map ref (O(1) updates) plus a React state array for rendering
 * - Progress updates batched via requestAnimationFrame (no React re-render per progress tick)
 * - SessionStorage writes only on status changes (not on every progress update)
 * - drainQueue runs from a ref so it never depends on items React state
 */

import * as React from "react"
import { tokenStorage } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 3
const MAX_AUTO_RETRIES = 3
const CHUNK_SIZE = 5 * 1024 * 1024           // 5 MiB per chunk
const CHUNKED_THRESHOLD = 100 * 1024 * 1024  // files > 100 MiB use chunked upload
const XHR_TIMEOUT_MS = 10 * 60 * 1000        // 10 minutes per chunk/request
const REFRESH_DEBOUNCE_MS = 500              // fire wms:files:changed once after last completion
const SESSION_STORAGE_KEY = "wms:upload-queue"
const API_BASE_URL = (
  process.env.NEXT_PUBLIC_UPLOAD_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  ""
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileRecord {
  id: string
  name: string
  path: string
  parent_path: string
  type: string
  size: number | null
  mime_type: string | null
  is_deleted: boolean
  deleted_at: string | null
  is_starred: boolean
  created_at: string
  updated_at: string
}

export interface UploadItem {
  id: string
  file: File | null
  path: string          // parent directory path
  filename: string
  status: "queued" | "uploading" | "done" | "error" | "paused"
  progress: number      // 0-100
  errorMessage?: string
  retryCount: number
  // chunked-only
  isChunked?: boolean
  uploadSessionId?: string
  chunksTotal?: number
  chunksUploaded?: number
  bytesPerSec?: number
  etaSeconds?: number
  result?: FileRecord
}

export interface UploadQueueContextType {
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

export const useUploadQueue = () => React.useContext(UploadQueueContext)

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

  xhr.timeout = XHR_TIMEOUT_MS
  xhr.open("POST", `${API_BASE_URL}/api/v1/files/upload`)
  const token = tokenStorage.getAccess()
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
  }
  xhr.ontimeout = () => onError("Request timed out", true)
  xhr.onerror = () => onError("Network error — check your connection", true)
  xhr.onload = () => {
    if (xhr.status === 201 || xhr.status === 200) {
      try { onDone(JSON.parse(xhr.responseText) as FileRecord) }
      catch { onDone({ id: "", name: item.filename } as FileRecord) }
    } else if (xhr.status === 409) {
      onError(`File already exists`, false)
    } else if (xhr.status >= 400 && xhr.status < 500) {
      onError(`Upload rejected (${xhr.status})`, false)
    } else {
      onError(`Server error (${xhr.status})`, true)
    }
  }
  xhr.send(form)
  return xhr
}

// ---------------------------------------------------------------------------
// Chunked upload
// ---------------------------------------------------------------------------

async function apiJson<T>(path: string, opts: RequestInit): Promise<T> {
  const token = tokenStorage.getAccess()
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw Object.assign(new Error(`HTTP ${res.status}: ${body}`), {
      status: res.status,
      retryable: res.status >= 500,
    })
  }
  return res.json() as Promise<T>
}

function uploadChunkXHR(
  uploadSessionId: string,
  chunkIndex: number,
  blob: Blob,
  onProgress: (loaded: number) => void,
): Promise<{ etag: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.timeout = XHR_TIMEOUT_MS
    xhr.open("PUT", `${API_BASE_URL}/api/v1/files/upload/chunk/${uploadSessionId}`)
    const token = tokenStorage.getAccess()
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
    xhr.setRequestHeader("X-Chunk-Index", String(chunkIndex))

    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded) }
    xhr.ontimeout = () => reject(Object.assign(new Error("Chunk timed out"), { retryable: true }))
    xhr.onerror = () => reject(Object.assign(new Error("Network error"), { retryable: true }))
    xhr.onload = () => {
      if (xhr.status === 200) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { resolve({ etag: "" }) }
      } else if (xhr.status >= 500) {
        reject(Object.assign(new Error(`Server error ${xhr.status}`), { retryable: true }))
      } else {
        reject(Object.assign(new Error(`Chunk rejected ${xhr.status}`), { retryable: false }))
      }
    }
    xhr.send(blob)
  })
}

async function runChunkedUpload(
  item: UploadItem,
  onProgress: (progress: number, chunksUploaded: number, chunksTotal: number, bytesPerSec: number | undefined) => void,
  onDone: (result: FileRecord) => void,
  onError: (msg: string, retryable: boolean) => void,
) {
  const file = item.file as File
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  let sessionId: string
  try {
    const init = await apiJson<{ upload_id: string; chunk_size: number }>(
      "/api/v1/files/upload/init",
      {
        method: "POST",
        body: JSON.stringify({
          filename: item.filename,
          path: item.path,
          total_size: file.size,
          total_chunks: totalChunks,
          mime_type: file.type || "application/octet-stream",
        }),
      },
    )
    sessionId = init.upload_id
  } catch (e: unknown) {
    const err = e as { message?: string; retryable?: boolean }
    onError(err.message ?? "Init failed", err.retryable ?? true)
    return
  }

  let uploadedBytes = 0
  const startTime = Date.now()
  for (let i = 0; i < totalChunks; i++) {
    const blob = file.slice(i * CHUNK_SIZE, Math.min((i + 1) * CHUNK_SIZE, file.size))
    let attempts = 0
    while (attempts < MAX_AUTO_RETRIES) {
      try {
        await uploadChunkXHR(sessionId, i, blob, (loaded) => {
          const chunkBase = i * CHUNK_SIZE
          const totalLoaded = chunkBase + loaded
          const elapsed = (Date.now() - startTime) / 1000
          const bytesPerSec = elapsed > 0 ? Math.round(totalLoaded / elapsed) : undefined
          onProgress(
            Math.round((totalLoaded / file.size) * 100),
            i,
            totalChunks,
            bytesPerSec,
          )
        })
        uploadedBytes += blob.size
        break
      } catch (e: unknown) {
        const err = e as { retryable?: boolean; message?: string }
        attempts++
        if (!err.retryable || attempts >= MAX_AUTO_RETRIES) {
          // abort session
          apiJson(`/api/v1/files/upload/abort/${sessionId}`, { method: "DELETE" }).catch(() => {})
          onError(err.message ?? "Chunk upload failed", err.retryable ?? false)
          return
        }
        await new Promise((r) => setTimeout(r, 1000 * attempts))
      }
    }
  }

  try {
    const result = await apiJson<FileRecord>(
      `/api/v1/files/upload/complete/${sessionId}`,
      { method: "POST", body: JSON.stringify({}) },
    )
    onDone(result)
  } catch (e: unknown) {
    const err = e as { message?: string; retryable?: boolean }
    onError(err.message ?? "Complete failed", err.retryable ?? true)
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  // React state — used only for rendering. Updated selectively.
  const [items, setItems] = React.useState<UploadItem[]>([])
  const [isPaused, setIsPaused] = React.useState(false)

  // Internal Map ref — O(1) updates, no React re-render for progress ticks
  const itemsMap = React.useRef<Map<string, UploadItem>>(new Map())
  const activeCount = React.useRef(0)
  const rafPending = React.useRef(false)
  const isPausedRef = React.useRef(false)
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const drainScheduled = React.useRef(false)

  // ---------------------------------------------------------------------------
  // Sync helpers
  // ---------------------------------------------------------------------------

  // Immediately flush the Map to React state (for status changes)
  const flushItems = React.useCallback(() => {
    setItems([...itemsMap.current.values()])
  }, [])

  // Flush via rAF for progress updates (batches multiple progress ticks into one render)
  const flushProgress = React.useCallback(() => {
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      rafPending.current = false
      setItems([...itemsMap.current.values()])
    })
  }, [])

  // Write only status/structural changes to sessionStorage (not progress)
  const persistQueue = React.useCallback(() => {
    try {
      const serializable = [...itemsMap.current.values()].map(({ file: _f, ...rest }) => rest)
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializable))
    } catch { /* storage full */ }
  }, [])

  // ---------------------------------------------------------------------------
  // Refresh debounce
  // ---------------------------------------------------------------------------

  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      window.dispatchEvent(new Event("wms:files:changed"))
      refreshTimer.current = null
    }, REFRESH_DEBOUNCE_MS)
  }, [])

  // ---------------------------------------------------------------------------
  // SessionStorage restore on mount
  // ---------------------------------------------------------------------------

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Omit<UploadItem, "file">[]
      const restored: UploadItem[] = saved.map((it) => ({
        ...it,
        file: null,
        status: it.status === "uploading" || it.status === "queued" ? "error" : it.status,
        errorMessage:
          it.status === "uploading" || it.status === "queued"
            ? "Upload interrupted — re-add the file to retry"
            : it.errorMessage,
      }))
      if (restored.length > 0) {
        for (const item of restored) itemsMap.current.set(item.id, item)
        flushItems()
      }
    } catch { /* corrupt storage */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---------------------------------------------------------------------------
  // Drain queue — runs from a ref, never depends on React state
  // ---------------------------------------------------------------------------

  const drainQueueRef = React.useRef<() => void>(() => {})

  drainQueueRef.current = () => {
    if (isPausedRef.current) return
    const slots = MAX_CONCURRENT - activeCount.current
    if (slots <= 0) return
    const queued = [...itemsMap.current.values()].filter(
      (i) => i.status === "queued" && i.file != null
    )
    queued.slice(0, slots).forEach((item) => startUploadRef.current(item))
  }

  const scheduleDrain = React.useCallback(() => {
    if (drainScheduled.current) return
    drainScheduled.current = true
    // Use setTimeout(0) so it runs after the current callstack settles
    setTimeout(() => {
      drainScheduled.current = false
      drainQueueRef.current()
    }, 0)
  }, [])

  // ---------------------------------------------------------------------------
  // Start upload
  // ---------------------------------------------------------------------------

  const startUploadRef = React.useRef<(item: UploadItem) => void>(() => {})

  startUploadRef.current = (item: UploadItem) => {
    if (!item.file) {
      const updated = { ...item, status: "error" as const, errorMessage: "File not available — re-add to retry" }
      itemsMap.current.set(item.id, updated)
      flushItems()
      return
    }

    activeCount.current++
    const uploading = { ...item, status: "uploading" as const, progress: 0 }
    itemsMap.current.set(item.id, uploading)
    flushItems()
    persistQueue()

    const onDone = (result: FileRecord) => {
      activeCount.current--
      const done = { ...itemsMap.current.get(item.id)!, status: "done" as const, progress: 100, result }
      itemsMap.current.set(item.id, done)
      flushItems()
      persistQueue()
      if (activeCount.current === 0) scheduleRefresh()
      scheduleDrain()
    }

    const onError = (msg: string, retryable: boolean) => {
      activeCount.current--
      const current = itemsMap.current.get(item.id)
      const nextRetry = (current?.retryCount ?? 0) + 1
      if (retryable && nextRetry <= MAX_AUTO_RETRIES) {
        const retrying = {
          ...current!,
          status: "queued" as const,
          retryCount: nextRetry,
          errorMessage: `Retrying (attempt ${nextRetry}/${MAX_AUTO_RETRIES})…`,
        }
        itemsMap.current.set(item.id, retrying)
        flushItems()
        const delay = 1000 * nextRetry
        setTimeout(() => scheduleDrain(), delay)
      } else {
        const errored = { ...current!, status: "error" as const, errorMessage: msg }
        itemsMap.current.set(item.id, errored)
        flushItems()
        persistQueue()
        scheduleDrain()
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
          const current = itemsMap.current.get(item.id)
          if (!current) return
          itemsMap.current.set(item.id, { ...current, progress, chunksUploaded, chunksTotal, bytesPerSec, etaSeconds })
          flushProgress() // rAF-batched — no sessionStorage write
        },
        onDone,
        onError,
      )
    } else {
      uploadWithXHR(
        item,
        (progress) => {
          const current = itemsMap.current.get(item.id)
          if (!current) return
          itemsMap.current.set(item.id, { ...current, progress })
          flushProgress() // rAF-batched — no sessionStorage write
        },
        onDone,
        onError,
      )
    }
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const addFilesWithPaths = React.useCallback(
    (entries: { file: File; path: string }[]) => {
      const newItems: UploadItem[] = entries.map(({ file, path }) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        path,
        filename: file.name,
        status: "queued" as const,
        progress: 0,
        retryCount: 0,
        isChunked: file.size > CHUNKED_THRESHOLD,
      }))
      for (const item of newItems) itemsMap.current.set(item.id, item)
      flushItems()
      persistQueue()
      scheduleDrain()
    },
    [flushItems, persistQueue, scheduleDrain],
  )

  const addFiles = React.useCallback(
    (files: File[], path: string) => {
      addFilesWithPaths(files.map((file) => ({ file, path })))
    },
    [addFilesWithPaths],
  )

  const retryItem = React.useCallback(
    (id: string) => {
      const item = itemsMap.current.get(id)
      if (!item || item.status !== "error" || !item.file) return
      const retried = { ...item, status: "queued" as const, progress: 0, retryCount: 0, errorMessage: undefined }
      itemsMap.current.set(id, retried)
      flushItems()
      scheduleDrain()
    },
    [flushItems, scheduleDrain],
  )

  const retryAllFailed = React.useCallback(() => {
    let changed = false
    for (const item of itemsMap.current.values()) {
      if (item.status === "error" && item.file) {
        itemsMap.current.set(item.id, { ...item, status: "queued", progress: 0, retryCount: 0, errorMessage: undefined })
        changed = true
      }
    }
    if (changed) { flushItems(); scheduleDrain() }
  }, [flushItems, scheduleDrain])

  const pauseAll = React.useCallback(() => {
    isPausedRef.current = true
    setIsPaused(true)
  }, [])

  const resumeAll = React.useCallback(() => {
    isPausedRef.current = false
    setIsPaused(false)
    scheduleDrain()
  }, [scheduleDrain])

  const clearCompleted = React.useCallback(() => {
    for (const [id, item] of itemsMap.current) {
      if (item.status === "done" || item.status === "error") itemsMap.current.delete(id)
    }
    flushItems()
    persistQueue()
  }, [flushItems, persistQueue])

  const removeItem = React.useCallback(
    (id: string) => {
      itemsMap.current.delete(id)
      flushItems()
      persistQueue()
    },
    [flushItems, persistQueue],
  )

  return (
    <UploadQueueContext.Provider
      value={{ items, addFiles, addFilesWithPaths, retryItem, retryAllFailed, pauseAll, resumeAll, isPaused, clearCompleted, removeItem }}
    >
      {children}
    </UploadQueueContext.Provider>
  )
}
