/**
 * File management API — typed wrappers around the FastAPI /api/v1/files/* endpoints.
 * All operations go through the backend; no direct R2 access from the browser.
 */

import { apiClient, API_BASE_URL } from "@/lib/api"
import { tokenStorage } from "@/lib/auth"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileRecord {
  id: string
  name: string
  path: string
  parent_path: string
  type: "file" | "folder"
  size?: number
  mime_type?: string
  is_deleted: boolean
  deleted_at?: string
  created_at: string
  updated_at: string
}

export interface QuotaInfo {
  used_bytes: number
  file_count: number
}

// ---------------------------------------------------------------------------
// List / Search
// ---------------------------------------------------------------------------

export async function listFiles(path = "", showTrash = false): Promise<FileRecord[]> {
  const params = new URLSearchParams({ path, show_trash: String(showTrash) })
  return apiClient<FileRecord[]>(`/api/v1/files/list?${params}`)
}

export async function searchFiles(q: string, path = ""): Promise<FileRecord[]> {
  const params = new URLSearchParams({ q })
  if (path) params.set("path", path)
  return apiClient<FileRecord[]>(`/api/v1/files/search?${params}`)
}

// ---------------------------------------------------------------------------
// Upload — uses raw fetch with FormData (apiClient forces Content-Type: application/json)
// ---------------------------------------------------------------------------

export async function uploadFile(
  file: File,
  path = "",
  overwrite = false,
): Promise<FileRecord> {
  const form = new FormData()
  form.append("file", file)
  form.append("path", path)
  form.append("overwrite", String(overwrite))

  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}/api/v1/files/upload`, {
    method: "POST",
    headers,
    body: form,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Upload failed" }))
    const error = new Error(err.detail ?? "Upload failed") as Error & { status?: number }
    error.status = res.status
    throw error
  }

  return res.json() as Promise<FileRecord>
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

export async function createFolder(parentPath: string, name: string): Promise<FileRecord> {
  return apiClient<FileRecord>("/api/v1/files/folder", {
    method: "POST",
    body: JSON.stringify({ parent_path: parentPath, name }),
  })
}

// ---------------------------------------------------------------------------
// Rename / Move / Copy
// ---------------------------------------------------------------------------

export async function renameFile(id: string, newName: string): Promise<FileRecord> {
  return apiClient<FileRecord>(`/api/v1/files/rename/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ name: newName }),
  })
}

export async function moveFile(id: string, newParent: string): Promise<FileRecord> {
  return apiClient<FileRecord>(`/api/v1/files/move/${id}`, {
    method: "POST",
    body: JSON.stringify({ dest_parent: newParent }),
  })
}

export async function copyFile(id: string, destParent: string): Promise<FileRecord> {
  return apiClient<FileRecord>(`/api/v1/files/copy/${id}`, {
    method: "POST",
    body: JSON.stringify({ dest_parent: destParent }),
  })
}

// ---------------------------------------------------------------------------
// Trash / Restore / Delete
// ---------------------------------------------------------------------------

export async function trashFile(id: string): Promise<FileRecord> {
  return apiClient<FileRecord>(`/api/v1/files/trash/${id}`, { method: "DELETE" })
}

export async function restoreFile(id: string): Promise<FileRecord> {
  return apiClient<FileRecord>(`/api/v1/files/restore/${id}`, { method: "POST" })
}

export async function deleteFilePermanent(id: string): Promise<void> {
  await apiClient<unknown>(`/api/v1/files/permanent/${id}`, { method: "DELETE" })
}

export async function emptyTrash(): Promise<void> {
  await apiClient<unknown>("/api/v1/files/empty-trash", { method: "DELETE" })
}

// ---------------------------------------------------------------------------
// Quota
// ---------------------------------------------------------------------------

export async function getQuota(): Promise<QuotaInfo> {
  return apiClient<QuotaInfo>("/api/v1/files/quota")
}

// ---------------------------------------------------------------------------
// Preview / Download URL resolution
//
// Uses the /preview-url and /download-url JSON endpoints instead of the
// redirect-based /preview and /download endpoints. This avoids the
// `redirect: "manual"` opaque-response problem where some environments
// return null for response.headers.get("Location").
// ---------------------------------------------------------------------------

async function _getPresignedUrl(endpoint: string): Promise<string | null> {
  try {
    const token = tokenStorage.getAccess()
    const headers: Record<string, string> = {}
    if (token) headers["Authorization"] = `Bearer ${token}`

    const res = await fetch(`${API_BASE_URL}${endpoint}`, { headers })
    if (!res.ok) return null
    const data = (await res.json()) as { url?: string }
    return data.url ?? null
  } catch {
    return null
  }
}

export async function getPreviewUrl(fileId: string): Promise<string | null> {
  return _getPresignedUrl(`/api/v1/files/preview-url/${fileId}`)
}

export async function getDownloadUrl(fileId: string, inline = false): Promise<string | null> {
  const qs = inline ? "?inline=true" : ""
  return _getPresignedUrl(`/api/v1/files/download-url/${fileId}${qs}`)
}

// ---------------------------------------------------------------------------
// Trigger a file download in the browser
// ---------------------------------------------------------------------------

export function triggerDownload(fileId: string, filename: string): void {
  ;(async () => {
    const url = await getDownloadUrl(fileId)
    if (!url) {
      // Fallback: open backend download endpoint directly in a new tab
      window.open(`${API_BASE_URL}/api/v1/files/download/${fileId}`, "_blank")
      return
    }
    try {
      const token = tokenStorage.getAccess()
      const headers: Record<string, string> = {}
      if (token) headers["Authorization"] = `Bearer ${token}`
      const res = await fetch(url, { headers, redirect: "follow" })
      if (!res.ok) return
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
    } catch {
      // Fallback to direct link
      window.open(url, "_blank")
    }
  })()
}

// ---------------------------------------------------------------------------
// ZIP download — fetches a blob and triggers browser download
// ---------------------------------------------------------------------------

export async function downloadZip(ids: string[], filename = "files.zip"): Promise<void> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}/api/v1/files/zip`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ids }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "ZIP download failed" }))
    throw new Error(err.detail ?? "ZIP download failed")
  }

  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}