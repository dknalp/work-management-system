/**
 * Shared types for the file explorer module.
 * Import these instead of re-declaring locally.
 */

export interface FileItem {
  name: string
  path: string
  type: "file" | "folder"
  size?: number
  lastModified?: string
  mimeType?: string
  is_starred?: boolean
  isDriveFile?: boolean
  color?: string
  emoji?: string
}

export type SortKey = "name" | "size" | "updatedAt"
export type SortDir = "asc" | "desc"

export type Clipboard =
  | { mode: "copy" | "cut"; paths: string[] }
  | null

export interface SearchFilters {
  type?: "file" | "folder"
  minSize?: number
  maxSize?: number
  after?: string
  before?: string
}