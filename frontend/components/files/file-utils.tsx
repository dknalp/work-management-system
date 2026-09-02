"use client"

import { triggerDownload } from "@/lib/actions/files"

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

export type FileItem = {
  id: string                // R2-backed FileRecord id (UUID)
  name: string
  path: string
  parent_path: string
  type: "file" | "folder"
  size?: number
  lastModified?: string     // ISO string (maps to updated_at)
  mimeType?: string
  color?: string | null
  icon_emoji?: string | null
  is_starred?: boolean
  // Drive-specific — kept for backward compat, not used in new storage flow
  isDriveFile?: boolean
  driveId?: string
  driveViewLink?: string
  driveDownloadLink?: string
  driveThumbnailLink?: string
  trashed?: boolean
  trashedAt?: string
}

export type SearchOptions = {
  query: string
  source?: "disk" | "drive" | "all"
  scope?: string
  fileTypes?: string[]
  includeContent?: boolean
}

export type SearchResult = FileItem & {
  score?: number
  matchType?: "name" | "content"
  contentSnippet?: string
}

export type TrashItem = FileItem & {
  trashName?: string
  originalName?: string
  originalPath?: string
  deletedAt?: string
  expiresAt?: string
}

// ---------------------------------------------------------------------------
// Conversion helper: FileRecord → FileItem
// ---------------------------------------------------------------------------

import type { FileRecord } from "@/lib/actions/files"

export function fileRecordToItem(record: FileRecord): FileItem {
  return {
    id: record.id,
    name: record.name,
    path: record.path,
    parent_path: record.parent_path,
    type: record.type,
    size: record.size,
    mimeType: record.mime_type,
    lastModified: record.updated_at,
    trashed: record.is_deleted,
    trashedAt: record.deleted_at,
    color: record.color,
    icon_emoji: record.icon_emoji,
    is_starred: record.is_starred ?? false,
  }
}

export function fileRecordToTrashItem(record: FileRecord): TrashItem {
  const item = fileRecordToItem(record)
  // Prefer backend-authoritative expires_at; fall back to client calculation
  // during rolling deploys where the API may not yet send the field.
  let expiresAt: string | undefined = record.expires_at
  if (!expiresAt && record.deleted_at) {
    const d = new Date(record.deleted_at)
    d.setDate(d.getDate() + 30)
    expiresAt = d.toISOString()
  }
  return {
    ...item,
    originalName: record.name,
    originalPath: record.path,
    deletedAt: record.deleted_at,
    expiresAt,
  }
}

// ---------------------------------------------------------------------------
// Icon / format helpers
// ---------------------------------------------------------------------------

export function getFileIcon(item: FileItem): string {
  if (item.type === "folder") return "folder"
  const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) return "image"
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext)) return "video"
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio"
  if (["pdf"].includes(ext)) return "pdf"
  if (["doc", "docx"].includes(ext)) return "word"
  if (["xls", "xlsx"].includes(ext)) return "excel"
  if (["ppt", "pptx"].includes(ext)) return "powerpoint"
  if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) return "archive"
  if (["js", "ts", "jsx", "tsx", "py", "go", "rs", "rb", "java", "cpp", "c", "h"].includes(ext)) return "code"
  if (["md", "mdx"].includes(ext)) return "markdown"
  if (["txt", "log", "csv"].includes(ext)) return "text"
  return "file"
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

/** Alias for formatFileSize — used by file-explorer */
export const formatSize = formatFileSize

export function isPreviewable(item: FileItem): boolean {
  if (item.type === "folder") return false
  const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif", "pdf", "txt", "md", "csv", "log"].includes(ext)
}

/** Returns true if the file is an image */
export function isImageFile(item: FileItem): boolean {
  const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
  return ["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)
}

/** Returns true if the file is a plain-text viewable file */
export function isTextFile(item: FileItem): boolean {
  const ext = item.name.split(".").pop()?.toLowerCase() ?? ""
  return ["txt", "md", "mdx", "csv", "log", "json", "yaml", "yml", "toml", "ini", "env", "sh", "bash", "zsh", "fish", "ts", "tsx", "js", "jsx", "py", "go", "rs", "rb", "java", "cpp", "c", "h", "css", "scss", "html", "xml", "sql"].includes(ext)
}

// ---------------------------------------------------------------------------
// URL helpers — now async (presigned R2 URLs fetched from backend)
// ---------------------------------------------------------------------------

/**
 * Returns a presigned URL for in-browser preview.
 * Falls back to null if the item has no id (legacy / Drive items).
 */
export async function getPreviewUrl(item: FileItem): Promise<string | null> {
  if (item.isDriveFile && item.driveViewLink) return item.driveViewLink
  if (!item.id) return null
  try {
    const { getPreviewUrl: fetchPreview } = await import("@/lib/actions/files")
    return await fetchPreview(item.id)
  } catch {
    return null
  }
}

/**
 * Returns a presigned download URL.
 * Falls back to Drive download link for Drive items.
 */
export async function getFileDownloadUrl(item: FileItem): Promise<string | null> {
  if (item.isDriveFile && item.driveDownloadLink) return item.driveDownloadLink
  if (!item.id) return null
  try {
    const { getDownloadUrl } = await import("@/lib/actions/files")
    return await getDownloadUrl(item.id)
  } catch {
    return null
  }
}

/** Synchronous open URL — kept for contexts where async isn't feasible (Drive only) */
export function getFileOpenUrl(item: FileItem): string {
  if (item.isDriveFile && item.driveViewLink) return item.driveViewLink
  // For R2 files, use triggerDownload which handles auth
  return "#"
}

/** Triggers a browser download for the given file */
export function downloadFile(item: FileItem): void {
  if (item.isDriveFile && item.driveDownloadLink) {
    const a = document.createElement("a")
    a.href = item.driveDownloadLink
    a.download = item.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    return
  }
  if (item.id) {
    triggerDownload(item.id, item.name)
  }
}