"use client"

/**
 * Upload queue context — direct browser-to-R2 upload via presigned URLs.
 *
 * Flow:
 *   1. addFilesWithPaths() splits files into batches of 20
 *   2. presignBatch() calls POST /api/v1/files/presign/batch → gets signed R2 URLs
 *   3. uploadWithPresign() XHR PUTs file directly to R2 (progress events work)
 *   4. confirmUpload() calls POST /api/v1/files/confirm/{file_id}
 *
 * Performance design for 1500+ files:
 *   - Items stored in a Map ref (O(1) updates) + React state only for rendering
 *   - Progress updates batched via requestAnimationFrame (no render per tick)
 *   - SessionStorage writes only on status changes, never on progress
 *   - drainQueue reads from ref — never depends on React items state
 */

import * as React from "react"
import { tokenStorage } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_CONCURRENT = 2                     // concurrent R2 uploads
const MAX_AUTO_RETRIES = 3
const CHUNKED_THRESHOLD = 100 * 1024 * 1024  // files > 100 MiB use multipart
const PART_SIZE = 5 * 1024 * 1024            // 5 MiB per multipart part
const XHR_TIMEOUT_MS = 10 * 60 * 1000        // 10 min per upload/part
const REFRESH_DEBOUNCE_MS = 500
const SESSION_STORAGE_KEY = "wms:upload-queue"
const PRESIGN_BATCH_SIZE = 20
const PRESIGN_EXPIRY_MS = 55 * 60 * 1000     // re-presign if older than 55 min
const API_BASE = process.env.NEXT_PUBLIC_API_URL || ""

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
  id: string               // queue item id (not file_id)
  file: File | null
  path: string             // parent directory path
  filename: string
  status: "presigning" | "queued" | "uploading" | "done" | "error" | "conflict"
  progress: number
  errorMessage?: string
  retryCount: number
  // set after presign
  file_id?: string
  upload_url?: string
  presignedAt?: number     // Date.now() when presigned — for expiry check
  // multipart
  isMultipart?: boolean
  upload_id?: string
  part_urls?: string[]
  // progress detail
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
// Auth helper
// ---------------------------------------------------------------------------

function authHeaders(): Record<string, string> {
  const token = tokenStorage.getAccess()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ---------------------------------------------------------------------------
// Presign API calls
// ---------------------------------------------------------------------------

interface PresignResult {
  file_id: string
  upload_url: string
  r2_key: string
  expires_at: string
  conflict: boolean
}

async function presignBatch(
  entries: { file: File; path: string; itemId: string }[],
): Promise<Map<string, PresignResult>> {
  const body = entries.map(({ file, path }) => ({
    filename: file.name,
    path,
    size: file.size,
    mime_type: file.type || "application/octet-stream",
    overwrite: false,
  }))

  const res = await fetch(`${API_BASE}/api/v1/files/presign/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`Presign failed: HTTP ${res.status}`)
  const results: PresignResult[] = await res.json()

  const map = new Map<string, PresignResult>()
  entries.forEach(({ itemId }, i) => map.set(itemId, results[i]))
  return map
}

async function presignMultipartInit(
  file: File,
  path: string,
  totalParts: number,
): Promise<{ file_id: string; upload_id: string; part_urls: string[] }> {
  const res = await fetch(`${API_BASE}/api/v1/files/presign/multipart/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      filename: file.name,
      path,
      size: file.size,
      mime_type: file.type || "application/octet-stream",
      total_parts: totalParts,
    }),
  })
  if (!res.ok) throw new Error(`Multipart init failed: HTTP ${res.status}`)
  return res.json()
}

async function presignMultipartComplete(
  file_id: string,
  upload_id: string,
  parts: { part_number: number; etag: string }[],
): Promise<FileRecord> {
  const res = await fetch(`${API_BASE}/api/v1/files/presign/multipart/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ file_id, upload_id, parts }),
  })
  if (!res.ok) throw new Error(`Multipart complete failed: HTTP ${res.status}`)
  return res.json()
}

async function confirmUpload(file_id: string, size: number): Promise<FileRecord> {
  const res = await fetch(`${API_BASE}/api/v1/files/confirm/${file_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ size }),
  })
  if (!res.ok) throw new Error(`Confirm failed: HTTP ${res.status}`)
  return res.json()
}

// ---------------------------------------------------------------------------
// XHR PUT to R2 (single file)
// ---------------------------------------------------------------------------

function xhrPutR2(
  url: string,
  file: File,
  onProgress: (p: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.timeout = XHR_TIMEOUT_MS
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream")

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.ontimeout = () => reject(Object.assign(new Error("Upload timed out"), { retryable: true }))
    xhr.onerror = () => reject(Object.assign(new Error("Network error — check your connection"), { retryable: true }))
    xhr.onload = () => {
      if (xhr.status === 200) resolve()
      else if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504)
        reject(Object.assign(new Error(`Gateway error (${xhr.status})`), { retryable: true }))
      else
        reject(Object.assign(new Error(`R2 error (${xhr.status})`), { retryable: xhr.status >= 500 }))
    }
    xhr.send(file)
  })
}

// ---------------------------------------------------------------------------
// XHR PUT one multipart part to R2
// ---------------------------------------------------------------------------

function xhrPutPart(
  url: string,
  blob: Blob,
  onProgress: (loaded: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.timeout = XHR_TIMEOUT_MS
    xhr.open("PUT", url)
    xhr.setRequestHeader("Content-Type", "application/octet-stream")

    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded) }
    xhr.ontimeout = () => reject(Object.assign(new Error("Part timed out"), { retryable: true }))
    xhr.onerror = () => reject(Object.assign(new Error("Network error"), { retryable: true }))
    xhr.onload = () => {
      if (xhr.status === 200) {
        const etag = xhr.getResponseHeader("ETag") ?? ""
        resolve(etag)
      } else {
        reject(Object.assign(new Error(`Part error (${xhr.status})`), { retryable: xhr.status >= 500 }))
      }
    }
    xhr.send(blob)
  })
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function UploadQueueProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<UploadItem[]>([])
  const [isPaused, setIsPaused] = React.useState(false)

  const itemsMap = React.useRef<Map<string, UploadItem>>(new Map())
  const activeCount = React.useRef(0)
  const isPausedRef = React.useRef(false)
  const rafPending = React.useRef(false)
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const drainScheduled = React.useRef(false)

  // ── sync helpers ──────────────────────────────────────────────────────────

  const flushItems = React.useCallback(() => {
    setItems([...itemsMap.current.values()])
  }, [])

  const flushProgress = React.useCallback(() => {
    if (rafPending.current) return
    rafPending.current = true
    requestAnimationFrame(() => {
      rafPending.current = false
      setItems([...itemsMap.current.values()])
    })
  }, [])

  const persistQueue = React.useCallback(() => {
    try {
      const serializable = [...itemsMap.current.values()].map(
        ({ file: _f, ...rest }) => rest,
      )
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(serializable))
    } catch { /* storage full */ }
  }, [])

  const scheduleRefresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current)
    refreshTimer.current = setTimeout(() => {
      window.dispatchEvent(new Event("wms:files:changed"))
      refreshTimer.current = null
    }, REFRESH_DEBOUNCE_MS)
  }, [])

  // ── SessionStorage restore ─────────────────────────────────────────────────

  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as Omit<UploadItem, "file">[]
      const restored: UploadItem[] = saved.map((it) => ({
        ...it,
        file: null,
        status:
          it.status === "uploading" || it.status === "queued" || it.status === "presigning"
            ? "error"
            : it.status,
        errorMessage:
          it.status === "uploading" || it.status === "queued" || it.status === "presigning"
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

  // ── drain queue ───────────────────────────────────────────────────────────

  const drainQueueRef = React.useRef<() => void>(() => {})
  drainQueueRef.current = () => {
    if (isPausedRef.current) return
    const slots = MAX_CONCURRENT - activeCount.current
    if (slots <= 0) return
    const queued = [...itemsMap.current.values()].filter(
      (i) => i.status === "queued" && i.file != null && i.upload_url,
    )
    queued.slice(0, slots).forEach((item) => startUploadRef.current(item))
  }

  const scheduleDrain = React.useCallback(() => {
    if (drainScheduled.current) return
    drainScheduled.current = true
    setTimeout(() => {
      drainScheduled.current = false
      drainQueueRef.current()
    }, 0)
  }, [])

  // ── upload execution ──────────────────────────────────────────────────────

  const startUploadRef = React.useRef<(item: UploadItem) => void>(() => {})
  startUploadRef.current = (item: UploadItem) => {
    if (!item.file || !item.upload_url) return

    // Re-presign if URL is about to expire
    if (item.presignedAt && Date.now() - item.presignedAt > PRESIGN_EXPIRY_MS) {
      const updated = { ...item, status: "presigning" as const }
      itemsMap.current.set(item.id, updated)
      flushItems()
      presignBatch([{ file: item.file, path: item.path, itemId: item.id }])
        .then((res) => {
          const r = res.get(item.id)
          if (!r) return
          const refreshed = {
            ...itemsMap.current.get(item.id)!,
            file_id: r.file_id,
            upload_url: r.upload_url,
            presignedAt: Date.now(),
            status: "queued" as const,
          }
          itemsMap.current.set(item.id, refreshed)
          flushItems()
          scheduleDrain()
        })
        .catch(() => {
          const errored = { ...itemsMap.current.get(item.id)!, status: "error" as const, errorMessage: "Re-presign failed" }
          itemsMap.current.set(item.id, errored)
          flushItems()
        })
      return
    }

    activeCount.current++
    itemsMap.current.set(item.id, { ...item, status: "uploading", progress: 0 })
    flushItems()
    persistQueue()

    const file = item.file

    const onDone = (result: FileRecord) => {
      activeCount.current--
      itemsMap.current.set(item.id, { ...itemsMap.current.get(item.id)!, status: "done", progress: 100, result })
      flushItems()
      persistQueue()
      if (activeCount.current === 0) scheduleRefresh()
      scheduleDrain()
    }

    const onError = (msg: string, retryable: boolean) => {
      activeCount.current--
      const current = itemsMap.current.get(item.id)!
      const nextRetry = (current.retryCount ?? 0) + 1
      if (retryable && nextRetry <= MAX_AUTO_RETRIES) {
        itemsMap.current.set(item.id, {
          ...current,
          status: "queued",
          retryCount: nextRetry,
          errorMessage: `Retrying (${nextRetry}/${MAX_AUTO_RETRIES})…`,
        })
        flushItems()
        setTimeout(() => scheduleDrain(), 1000 * nextRetry)
      } else {
        itemsMap.current.set(item.id, { ...current, status: "error", errorMessage: msg })
        flushItems()
        persistQueue()
        scheduleDrain()
      }
    }

    if (item.isMultipart && item.upload_id && item.part_urls) {
      // Multipart: PUT each part to its presigned URL
      const partUrls = item.part_urls
      const totalParts = partUrls.length
      const startTime = Date.now()
      let totalLoaded = 0
      const parts: { part_number: number; etag: string }[] = []

      ;(async () => {
        for (let i = 0; i < totalParts; i++) {
          const blob = file.slice(i * PART_SIZE, Math.min((i + 1) * PART_SIZE, file.size))
          let attempts = 0
          let etag = ""
          while (attempts < MAX_AUTO_RETRIES) {
            try {
              etag = await xhrPutPart(partUrls[i], blob, (loaded) => {
                const partBase = i * PART_SIZE
                totalLoaded = partBase + loaded
                const elapsed = (Date.now() - startTime) / 1000
                const bytesPerSec = elapsed > 0 ? Math.round(totalLoaded / elapsed) : undefined
                const etaSeconds = bytesPerSec && bytesPerSec > 0
                  ? Math.round((file.size - totalLoaded) / bytesPerSec)
                  : undefined
                const current = itemsMap.current.get(item.id)
                if (current) {
                  itemsMap.current.set(item.id, {
                    ...current,
                    progress: Math.round((totalLoaded / file.size) * 100),
                    bytesPerSec,
                    etaSeconds,
                  })
                  flushProgress()
                }
              })
              break
            } catch (e: unknown) {
              attempts++
              const err = e as { retryable?: boolean; message?: string }
              if (!err.retryable || attempts >= MAX_AUTO_RETRIES) {
                onError(err.message ?? "Part upload failed", err.retryable ?? false)
                return
              }
              await new Promise((r) => setTimeout(r, 1000 * attempts))
            }
          }
          parts.push({ part_number: i + 1, etag })
        }

        try {
          const result = await presignMultipartComplete(item.file_id!, item.upload_id!, parts)
          onDone(result)
        } catch (e: unknown) {
          const err = e as { message?: string }
          onError(err.message ?? "Complete failed", true)
        }
      })()
    } else {
      // Single file: PUT directly to R2
      xhrPutR2(
        item.upload_url!,
        file,
        (progress) => {
          const current = itemsMap.current.get(item.id)
          if (current) {
            itemsMap.current.set(item.id, { ...current, progress })
            flushProgress()
          }
        },
      )
        .then(() => confirmUpload(item.file_id!, file.size))
        .then((result) => onDone(result))
        .catch((e: unknown) => {
          const err = e as { message?: string; retryable?: boolean }
          onError(err.message ?? "Upload failed", err.retryable ?? true)
        })
    }
  }

  // ── presign + enqueue ──────────────────────────────────────────────────────

  const addFilesWithPaths = React.useCallback(
    (entries: { file: File; path: string }[]) => {
      // Create queue items immediately (status=presigning)
      const newItems: UploadItem[] = entries.map(({ file, path }) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        path,
        filename: file.name,
        status: "presigning" as const,
        progress: 0,
        retryCount: 0,
        isMultipart: file.size > CHUNKED_THRESHOLD,
      }))
      for (const item of newItems) itemsMap.current.set(item.id, item)
      flushItems()

      // Process in batches of PRESIGN_BATCH_SIZE
      const batches: UploadItem[][] = []
      for (let i = 0; i < newItems.length; i += PRESIGN_BATCH_SIZE) {
        batches.push(newItems.slice(i, i + PRESIGN_BATCH_SIZE))
      }

      const processBatch = async (batch: UploadItem[]) => {
        // Split small and large files
        const small = batch.filter((it) => !it.isMultipart)
        const large = batch.filter((it) => it.isMultipart)

        // Presign small files in batch
        if (small.length > 0) {
          try {
            const results = await presignBatch(
              small.map((it) => ({ file: it.file!, path: it.path, itemId: it.id })),
            )
            for (const item of small) {
              const r = results.get(item.id)
              if (!r) continue
              const current = itemsMap.current.get(item.id)
              if (!current) continue
              if (r.conflict) {
                itemsMap.current.set(item.id, {
                  ...current,
                  status: "conflict",
                  errorMessage: "File already exists — skip or replace",
                })
              } else {
                itemsMap.current.set(item.id, {
                  ...current,
                  file_id: r.file_id,
                  upload_url: r.upload_url,
                  presignedAt: Date.now(),
                  status: "queued",
                })
              }
            }
          } catch (e: unknown) {
            const err = e as { message?: string }
            for (const item of small) {
              const current = itemsMap.current.get(item.id)
              if (current) {
                itemsMap.current.set(item.id, {
                  ...current,
                  status: "error",
                  errorMessage: err.message ?? "Presign failed",
                })
              }
            }
          }
        }

        // Presign large files individually (multipart init)
        for (const item of large) {
          try {
            const file = item.file!
            const totalParts = Math.ceil(file.size / PART_SIZE)
            const r = await presignMultipartInit(file, item.path, totalParts)
            const current = itemsMap.current.get(item.id)
            if (current) {
              itemsMap.current.set(item.id, {
                ...current,
                file_id: r.file_id,
                upload_id: r.upload_id,
                part_urls: r.part_urls,
                presignedAt: Date.now(),
                status: "queued",
              })
            }
          } catch (e: unknown) {
            const err = e as { message?: string }
            const current = itemsMap.current.get(item.id)
            if (current) {
              itemsMap.current.set(item.id, {
                ...current,
                status: "error",
                errorMessage: err.message ?? "Multipart init failed",
              })
            }
          }
        }

        flushItems()
        persistQueue()
        scheduleDrain()
      }

      // Process batches sequentially to avoid flooding backend
      ;(async () => {
        for (const batch of batches) {
          await processBatch(batch)
        }
      })()
    },
    [flushItems, persistQueue, scheduleDrain],
  )

  const addFiles = React.useCallback(
    (files: File[], path: string) => addFilesWithPaths(files.map((file) => ({ file, path }))),
    [addFilesWithPaths],
  )

  // ── public API ─────────────────────────────────────────────────────────────

  const retryItem = React.useCallback(
    (id: string) => {
      const item = itemsMap.current.get(id)
      if (!item || item.status !== "error" || !item.file) return
      // If we still have a presigned URL, go straight to queued; otherwise re-presign
      if (item.upload_url && item.presignedAt && Date.now() - item.presignedAt < PRESIGN_EXPIRY_MS) {
        itemsMap.current.set(id, { ...item, status: "queued", progress: 0, retryCount: 0, errorMessage: undefined })
        flushItems()
        scheduleDrain()
      } else {
        // Re-presign
        itemsMap.current.set(id, { ...item, status: "presigning", progress: 0, retryCount: 0, errorMessage: undefined })
        flushItems()
        addFilesWithPaths([{ file: item.file, path: item.path }])
      }
    },
    [flushItems, scheduleDrain, addFilesWithPaths],
  )

  const retryAllFailed = React.useCallback(() => {
    const toRetry: { file: File; path: string }[] = []
    for (const item of itemsMap.current.values()) {
      if (item.status === "error" && item.file) {
        toRetry.push({ file: item.file, path: item.path })
        itemsMap.current.delete(item.id)
      }
    }
    if (toRetry.length > 0) {
      flushItems()
      addFilesWithPaths(toRetry)
    }
  }, [flushItems, addFilesWithPaths])

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
      if (item.status === "done" || item.status === "error" || item.status === "conflict")
        itemsMap.current.delete(id)
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
