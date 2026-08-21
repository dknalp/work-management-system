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
  color?: string | null
  icon_emoji?: string | null
  is_starred?: boolean
}

export interface SearchFilters {
  type?: "file" | "folder"
  mimeCategory?: "image" | "video" | "audio" | "document" | "spreadsheet" | "code" | "archive"
  minSize?: number
  maxSize?: number
  dateFrom?: string
  dateTo?: string
  isStarred?: boolean
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

export async function searchFiles(q: string, path = "", filters?: SearchFilters): Promise<FileRecord[]> {
  const params = new URLSearchParams({ q })
  if (path) params.set("path", path)
  if (filters?.type) params.set("type", filters.type)
  if (filters?.mimeCategory) params.set("mime_category", filters.mimeCategory)
  if (filters?.minSize !== undefined) params.set("min_size", String(filters.minSize))
  if (filters?.maxSize !== undefined) params.set("max_size", String(filters.maxSize))
  if (filters?.dateFrom) params.set("date_from", filters.dateFrom)
  if (filters?.dateTo) params.set("date_to", filters.dateTo)
  if (filters?.isStarred !== undefined) params.set("is_starred", String(filters.isStarred))
  return apiClient<FileRecord[]>(`/api/v1/files/search?${params}`)
}

export async function customizeFile(
  id: string,
  body: { color?: string; icon_emoji?: string }
): Promise<FileRecord> {
  return apiClient<FileRecord>(`/api/v1/files/customize/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  })
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
    const url = data.url ?? null
    if (!url) return null
    // If the backend returned a relative path (e.g. "/api/v1/files/preview/{id}"),
    // prepend API_BASE_URL so the caller always gets an absolute URL it can use
    // without knowing the backend origin.
    if (url.startsWith("/")) return `${API_BASE_URL}${url}`
    return url
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

// ── Starred ────────────────────────────────────────────────────────────────

export async function starFile(id: string): Promise<FileRecord> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/star/${id}`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Star failed")
  return res.json()
}

export async function listStarred(): Promise<FileRecord[]> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/starred`, { headers })
  if (!res.ok) throw new Error("Failed to load starred")
  return res.json()
}

// ── Recent ─────────────────────────────────────────────────────────────────

export async function listRecent(limit = 50): Promise<FileRecord[]> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/recent?limit=${limit}`, { headers })
  if (!res.ok) throw new Error("Failed to load recent")
  return res.json()
}

// ── Share ──────────────────────────────────────────────────────────────────

export interface FileShare {
  id: string
  file_id: string
  owner_id: string
  shared_with_user_id?: string
  share_token?: string
  permission_level: "view" | "edit" | "owner"
  expires_at?: string
  created_at: string
}

export async function createShare(
  fileId: string,
  body: { shared_with_user_id?: string; permission_level: "view" | "edit" | "owner"; expires_at?: string }
): Promise<FileShare> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/share/${fileId}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error("Share failed")
  return res.json()
}

export async function listShares(fileId: string): Promise<FileShare[]> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/share/${fileId}`, { headers })
  if (!res.ok) throw new Error("Failed to load shares")
  return res.json()
}

export async function deleteShare(shareId: string): Promise<void> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  await fetch(`${API_BASE_URL}/api/v1/files/share/${shareId}`, { method: "DELETE", headers })
}

export async function createShareLink(fileId: string): Promise<{ token: string; url: string }> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = {}
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/share/${fileId}/link`, {
    method: "POST",
    headers,
  })
  if (!res.ok) throw new Error("Link creation failed")
  return res.json()
}

// ── Bulk ───────────────────────────────────────────────────────────────────

export async function bulkMove(ids: string[], destParent: string): Promise<{ succeeded: string[]; failed: string[] }> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/bulk-move`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ids, dest_parent: destParent }),
  })
  if (!res.ok) throw new Error("Bulk move failed")
  return res.json()
}

export async function bulkCopy(ids: string[], destParent: string): Promise<{ succeeded: string[]; failed: string[] }> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/bulk-copy`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ids, dest_parent: destParent }),
  })
  if (!res.ok) throw new Error("Bulk copy failed")
  return res.json()
}

export async function bulkTrash(ids: string[]): Promise<{ succeeded: string[]; failed: string[] }> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`
  const res = await fetch(`${API_BASE_URL}/api/v1/files/bulk-trash`, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error("Bulk trash failed")
  return res.json()
}

// ---------------------------------------------------------------------------
// Google Drive import
// ---------------------------------------------------------------------------

export type DriveImportResult = FileRecord

/**
 * Import a single file from Google Drive into R2 storage.
 *
 * @param fileId      Google Drive file ID (from the Picker callback)
 * @param accessToken Short-lived OAuth access token with drive.readonly scope
 * @param parentPath  Destination folder inside the virtual filesystem (empty = root)
 * @param overwrite   Replace an existing file with the same name if true
 */
export async function importFromDrive(
  fileId: string,
  accessToken: string,
  parentPath: string = "",
  isFolder: boolean = false,
  overwrite: boolean = false,
): Promise<DriveImportResult> {
  const token = tokenStorage.getAccess()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["Authorization"] = `Bearer ${token}`

  const res = await fetch(`${API_BASE_URL}/api/v1/files/import-from-drive`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      file_id: fileId,
      access_token: accessToken,
      parent_path: parentPath,
      is_folder: isFolder,
      overwrite,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { detail?: string }).detail ?? "Google Drive içe aktarma başarısız")
  }

  return res.json()
}