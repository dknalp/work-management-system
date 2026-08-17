"use client"

import * as React from "react"
import { tokenStorage } from "@/lib/auth"

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3052"

export interface FileRecord {
  name: string
  path: string
  size: number
  modified: string
  is_dir: boolean
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

interface UploadQueueContextType {
  items: UploadItem[]
  addFiles: (files: File[], path: string) => void
  retryItem: (id: string) => void
  clearCompleted: () => void
  removeItem: (id: string) => void
}

export const UploadQueueContext = React.createContext<UploadQueueContextType>({
  items: [],
  addFiles: () => {},
  retryItem: () => {},
  clearCompleted: () => {},
  removeItem: () => {},
})

function uploadWithXHR(
  item: UploadItem,
  onProgress: (p: number) => void,
  onDone: (result: FileRecord) => void,
  onError: (msg: string) => void,
): XMLHttpRequest {
  const xhr = new XMLHttpRequest()
  const form = new FormData()
  form.append("file", item.file)
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
        onError("Invalid response")
      }
    } else {
      try {
        const body = JSON.parse(xhr.responseText) as { detail?: string }
        onError(body?.detail || "Upload failed")
      } catch {
        onError("Upload failed")
      }
    }
  }
  xhr.onerror = () => onError("Network error")

  xhr.open("POST", `${API_BASE_URL}/api/v1/files/upload`)
  const token = tokenStorage.getAccess()
  if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`)
  xhr.send(form)
  return xhr
}

const MAX_CONCURRENT = 3

export function UploadQueueProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [items, setItems] = React.useState<UploadItem[]>([])

  const updateItem = React.useCallback(
    (id: string, patch: Partial<UploadItem>) => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      )
    },
    [],
  )

  const startUpload = React.useCallback(
    (item: UploadItem) => {
      updateItem(item.id, { status: "uploading", progress: 0 })
      uploadWithXHR(
        item,
        (progress) => updateItem(item.id, { progress }),
        (result) => updateItem(item.id, { status: "done", progress: 100, result }),
        (errorMessage) => updateItem(item.id, { status: "error", errorMessage }),
      )
    },
    [updateItem],
  )

  // Watch for pending items and start them when slots are available
  React.useEffect(() => {
    const uploading = items.filter((i) => i.status === "uploading").length
    const slots = MAX_CONCURRENT - uploading
    if (slots <= 0) return

    const pending = items.filter((i) => i.status === "pending").slice(0, slots)
    pending.forEach((item) => startUpload(item))
  }, [items, startUpload])

  const addFiles = React.useCallback((files: File[], path: string) => {
    const newItems: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      path,
      status: "pending",
      progress: 0,
    }))
    setItems((prev) => [...prev, ...newItems])
  }, [])

  const retryItem = React.useCallback(
    (id: string) => {
      setItems((prev) => {
        const item = prev.find((i) => i.id === id)
        if (!item) return prev
        return prev.map((i) =>
          i.id === id ? { ...i, status: "pending", progress: 0, errorMessage: undefined } : i,
        )
      })
    },
    [],
  )

  const clearCompleted = React.useCallback(() => {
    setItems((prev) =>
      prev.filter((i) => i.status !== "done" && i.status !== "error"),
    )
  }, [])

  const removeItem = React.useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  return (
    <UploadQueueContext.Provider
      value={{ items, addFiles, retryItem, clearCompleted, removeItem }}
    >
      {children}
    </UploadQueueContext.Provider>
  )
}

export function useUploadQueue() {
  return React.useContext(UploadQueueContext)
}