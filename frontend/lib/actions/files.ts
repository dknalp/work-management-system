"use server"

import fs from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"
import { getStoragePath } from "@/lib/storage-config"
import { requireAuth } from "@/lib/server-auth"

async function ensureRootDir() {
  try {
    await fs.access(getStoragePath())
  } catch {
    await fs.mkdir(getStoragePath(), { recursive: true })
  }
}

function getSafePath(relativePath: string): string {
  const rootDir = getStoragePath()
  const fullPath = path.resolve(rootDir, relativePath)
  if (fullPath !== rootDir && !fullPath.startsWith(rootDir + path.sep)) {
    throw new Error("Forbidden: path outside storage root")
  }
  return fullPath
}

// Strip path separators and null bytes from a bare file/folder name
function sanitizeName(name: string): string {
  return name
    .replace(/[\x00/\\]/g, "")   // remove null bytes and path separators
    .replace(/\.{2,}/g, ".")      // collapse .. sequences
    .trim()
    .slice(0, 255)                // limit to max filename length
}

export type FileItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  updatedAt: string
  childCount?: number
  source?: "disk" | "drive"
  driveFileId?: string
}

export async function listFiles(relativePath: string = ""): Promise<FileItem[]> {
  await requireAuth()
  await ensureRootDir()
  const rootDir = getStoragePath()
  const fullPath = getSafePath(relativePath)

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const items = await Promise.all(
      entries
        .filter((e) => e.name !== ".trash")
        .map(async (entry) => {
          const entryPath = path.join(fullPath, entry.name)
          const stats = await fs.stat(entryPath)
          const relPath = path.relative(rootDir, entryPath)

          let childCount: number | undefined
          if (entry.isDirectory()) {
            try {
              // Use withFileTypes to avoid a second stat per entry
              const children = await fs.readdir(entryPath, { withFileTypes: true })
              childCount = children.filter((c) => c.name !== ".trash").length
            } catch {
              childCount = 0
            }
          }

          return {
            name: entry.name,
            path: relPath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            updatedAt: stats.mtime.toISOString(),
            childCount,
          }
        })
    )

    return items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1
      if (!a.isDirectory && b.isDirectory) return 1
      return a.name.localeCompare(b.name)
    })
  } catch (error) {
    console.error("Error listing files:", error)
    return []
  }
}

export async function deleteItem(relativePath: string) {
  await requireAuth()
  const fullPath = getSafePath(relativePath)
  try {
    await fs.rm(fullPath, { recursive: true, force: true })
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error deleting item:", error)
    return { success: false, error: "Failed to delete item" }
  }
}

export async function moveToTrash(relativePath: string) {
  await requireAuth()
  const rootDir = getStoragePath()
  const trashDir = path.join(rootDir, ".trash")
  const fullPath = getSafePath(relativePath)
  const fileName = path.basename(relativePath)

  try {
    await fs.mkdir(trashDir, { recursive: true })
    const trashName = `${Date.now()}_${fileName}`
    const dest = path.join(trashDir, trashName)
    await fs.rename(fullPath, dest)
    await fs.writeFile(
      path.join(trashDir, `${trashName}.meta.json`),
      JSON.stringify({ originalPath: relativePath }),
      "utf-8"
    )
    revalidatePath("/files", "layout")
    return { success: true as const, trashName, originalName: fileName, originalPath: relativePath }
  } catch (error) {
    console.error("Error moving to trash:", error)
    return { success: false as const, error: "Failed to move to trash" }
  }
}

export async function renameItem(oldPath: string, newName: string) {
  await requireAuth()
  const safe = sanitizeName(newName)
  if (!safe) return { success: false, error: "Invalid name" }
  const oldFullPath = getSafePath(oldPath)
  const dir = path.dirname(oldFullPath)
  const newFullPath = path.join(dir, safe)

  if (oldFullPath === newFullPath) return { success: true }

  try {
    // Check for destination conflict
    try {
      await fs.access(newFullPath)
      return { success: false, error: "A file or folder with that name already exists" }
    } catch {
      // destination does not exist — safe to rename
    }
    await fs.rename(oldFullPath, newFullPath)
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error renaming item:", error)
    return { success: false, error: "Failed to rename item" }
  }
}

export async function createFolder(parentPath: string, name: string) {
  await requireAuth()
  const safe = sanitizeName(name)
  if (!safe) return { success: false, error: "Invalid folder name" }
  const fullPath = path.join(getSafePath(parentPath), safe)
  try {
    await fs.mkdir(fullPath, { recursive: true })
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error creating folder:", error)
    return { success: false, error: "Failed to create folder" }
  }
}

export async function moveItem(sourcePath: string, targetDirPath: string) {
  await requireAuth()
  const safeSourcePath = getSafePath(sourcePath)
  const fileName = path.basename(sourcePath)
  const safeTargetDirPath = getSafePath(targetDirPath)
  const destinationPath = path.join(safeTargetDirPath, fileName)

  if (safeSourcePath === destinationPath) {
    return { success: false, error: "Source and destination are the same" }
  }

  try {
    await fs.access(safeSourcePath)
    // Check for destination conflict before overwriting
    try {
      await fs.access(destinationPath)
      return { success: false, error: "A file or folder with that name already exists at the destination" }
    } catch {
      // destination does not exist — safe to move
    }
    await fs.rename(safeSourcePath, destinationPath)
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Move error:", error)
    return { success: false, error: "Failed to move item" }
  }
}

export async function copyItem(sourcePath: string, targetDirPath: string) {
  await requireAuth()
  const safeSourcePath = getSafePath(sourcePath)
  const fileName = path.basename(sourcePath)
  const safeTargetDirPath = getSafePath(targetDirPath)
  let destinationPath = path.join(safeTargetDirPath, fileName)

  // Auto-suffix when copying to the same directory or when name already exists
  const ext = path.extname(fileName)
  const base = path.basename(fileName, ext)
  let suffix = 1
  while (true) {
    try {
      await fs.access(destinationPath)
      // destination exists — try next suffix
      destinationPath = path.join(safeTargetDirPath, `${base} (kopya${suffix > 1 ? ` ${suffix}` : ""})${ext}`)
      suffix++
    } catch {
      // destination does not exist — safe to copy here
      break
    }
  }

  try {
    await fs.access(safeSourcePath)
    await fs.cp(safeSourcePath, destinationPath, { recursive: true })
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Copy error:", error)
    return { success: false, error: "Failed to copy item" }
  }
}

// ─── Advanced Search ──────────────────────────────────────────────────────────

export type SearchResult = FileItem & {
  matchType: "name" | "content"
  contentSnippet?: string
}

export type SearchOptions = {
  query: string
  scope: string       // relative path to search under, "" = entire storage
  fileTypes: string[] // [] = all types, ["pdf","docx"] = specific extensions
  includeContent: boolean
  maxResults?: number
}

const CONCURRENCY = 10

export async function searchFiles(opts: SearchOptions): Promise<SearchResult[]> {
  await requireAuth()
  await ensureRootDir()
  const rootDir = getStoragePath()
  const { query, scope, fileTypes, includeContent, maxResults = 100 } = opts
  if (!query.trim()) return []

  const scopeDir = scope
    ? path.join(rootDir, path.normalize(scope).replace(/^(\.\.(\/|\\|$))+/, ""))
    : rootDir

  const results: SearchResult[] = []
  let done = false

  // Semaphore to cap concurrent I/O
  let active = 0
  const queue: (() => void)[] = []
  function acquire(): Promise<void> {
    return new Promise((resolve) => {
      if (active < CONCURRENCY) { active++; resolve() }
      else queue.push(() => { active++; resolve() })
    })
  }
  function release() {
    active--
    const next = queue.shift()
    if (next) next()
  }

  const { extractText, getSnippet } = await import("@/lib/file-content")

  async function walk(dir: string): Promise<void> {
    if (done) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let entries: any[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" })
    } catch {
      return
    }

    await Promise.all(
      (entries as Array<{ name: unknown; isDirectory: () => boolean }>).map(async (entry) => {
        if (done) return
        const name = entry.name as string
        if (name === ".trash") return
        const entryPath = path.join(dir, name)
        const isDir = entry.isDirectory()

        if (!isDir) {
          const ext = path.extname(name).toLowerCase().replace(/^\./, "")

          // Type filter
          if (fileTypes.length > 0 && !fileTypes.includes(ext)) {
            return
          }

          const queryLower = query.toLowerCase()
          const nameLower = name.toLowerCase()

          let matchType: "name" | "content" | null = null
          let contentSnippet: string | undefined

          // Name match
          if (nameLower.includes(queryLower)) {
            matchType = "name"
          }

          // Content match (opt-in)
          if (includeContent && matchType !== "name") {
            await acquire()
            try {
              const text = await extractText(entryPath, ext)
              if (text && text.toLowerCase().includes(queryLower)) {
                matchType = "content"
                contentSnippet = getSnippet(text, query)
              }
            } finally {
              release()
            }
          }

          if (matchType) {
            await acquire()
            try {
              const stats = await fs.stat(entryPath)
              results.push({
                name,
                path: path.relative(rootDir, entryPath),
                isDirectory: false,
                size: stats.size,
                updatedAt: stats.mtime.toISOString(),
                matchType,
                contentSnippet,
              })
            } finally {
              release()
            }
            if (results.length >= maxResults) done = true
          }
        } else {
          await walk(entryPath)
        }
      })
    )
  }

  await walk(scopeDir)
  return results
}

export type TrashItem = {
  trashName: string   // timestamped name on disk
  originalName: string
  originalPath: string  // relative path from storage root (for restore-to-original-location)
  isDirectory: boolean
  size: number
  deletedAt: string
  expiresAt: string
}

const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

async function purgeExpiredTrash(trashDir: string) {
  const cutoff = Date.now() - TRASH_TTL_MS
  try {
    const entries = await fs.readdir(trashDir, { withFileTypes: true })
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.endsWith(".meta.json")) return
        const underscoreIdx = entry.name.indexOf("_")
        const ts = underscoreIdx >= 0 ? parseInt(entry.name.slice(0, underscoreIdx)) : NaN
        if (!isNaN(ts) && ts < cutoff) {
          await fs.rm(path.join(trashDir, entry.name), { recursive: true, force: true })
          await fs.unlink(path.join(trashDir, `${entry.name}.meta.json`)).catch(() => {})
        }
      })
    )
  } catch {
    // best-effort
  }
}

export async function listTrash(): Promise<TrashItem[]> {
  await requireAuth()
  const trashDir = path.join(getStoragePath(), ".trash")
  try {
    await fs.access(trashDir)
  } catch {
    return []
  }
  // Lazy cleanup — remove items older than 7 days on every listing
  await purgeExpiredTrash(trashDir)
  try {
    const entries = await fs.readdir(trashDir, { withFileTypes: true })
    const items = await Promise.all(
      entries
        .filter((e) => !e.name.endsWith(".meta.json"))
        .map(async (entry) => {
          const stats = await fs.stat(path.join(trashDir, entry.name))
          const underscoreIdx = entry.name.indexOf("_")
          const originalName = underscoreIdx >= 0 ? entry.name.slice(underscoreIdx + 1) : entry.name
          const ts = underscoreIdx >= 0 ? parseInt(entry.name.slice(0, underscoreIdx)) : stats.mtimeMs
          const expiresAt = new Date(ts + TRASH_TTL_MS).toISOString()
          let originalPath = originalName
          try {
            const meta = JSON.parse(
              await fs.readFile(path.join(trashDir, `${entry.name}.meta.json`), "utf-8")
            )
            if (meta.originalPath) originalPath = meta.originalPath
          } catch {
            // no meta file — fall back to originalName
          }
          return {
            trashName: entry.name,
            originalName,
            originalPath,
            isDirectory: entry.isDirectory(),
            size: stats.size,
            deletedAt: new Date(ts).toISOString(),
            expiresAt,
          }
        })
    )
    return items.sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))
  } catch (error) {
    console.error("Error listing trash:", error)
    return []
  }
}

export async function restoreFromTrash(trashName: string, restorePath: string) {
  await requireAuth()
  const rootDir = getStoragePath()
  const trashDir = path.join(rootDir, ".trash")
  // Only allow plain names — no path separators
  const safeName = path.basename(trashName)
  const trashFullPath = path.join(trashDir, safeName)
  const destFullPath = getSafePath(restorePath)

  // Verify trashFullPath is actually inside trashDir
  if (!trashFullPath.startsWith(trashDir + path.sep) && trashFullPath !== trashDir) {
    return { success: false, error: "Invalid trash name" }
  }

  try {
    await fs.access(trashFullPath)
    await fs.mkdir(path.dirname(destFullPath), { recursive: true })
    await fs.rename(trashFullPath, destFullPath)
    await fs.unlink(path.join(trashDir, `${safeName}.meta.json`)).catch(() => {})
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error restoring from trash:", error)
    return { success: false, error: "Failed to restore item" }
  }
}

export async function deleteFromTrash(trashName: string) {
  await requireAuth()
  const trashDir = path.join(getStoragePath(), ".trash")
  const safeName = path.basename(trashName)
  const fullPath = path.join(trashDir, safeName)
  if (!fullPath.startsWith(trashDir + path.sep)) {
    return { success: false, error: "Invalid trash name" }
  }
  try {
    await fs.rm(fullPath, { recursive: true, force: true })
    await fs.unlink(path.join(trashDir, `${safeName}.meta.json`)).catch(() => {})
    return { success: true }
  } catch (error) {
    console.error("Error deleting from trash:", error)
    return { success: false, error: "Failed to delete permanently" }
  }
}

export async function emptyTrash() {
  await requireAuth()
  const trashDir = path.join(getStoragePath(), ".trash")
  try {
    await fs.rm(trashDir, { recursive: true, force: true })
    await fs.mkdir(trashDir, { recursive: true })
    return { success: true }
  } catch (error) {
    console.error("Error emptying trash:", error)
    return { success: false, error: "Failed to empty trash" }
  }
}

export async function getStorageConfig() {
  const { getStorageConfig: _get } = await import("@/lib/storage-config")
  return _get()
}

export async function updateStoragePath(newPath: string) {
  "use server"
  await requireAuth()
  try {
    // Validate: must be an absolute path pointing to an existing or creatable directory
    const resolved = path.isAbsolute(newPath) ? newPath : path.resolve(process.cwd(), newPath)
    await fs.mkdir(resolved, { recursive: true })
    const stat = await fs.stat(resolved)
    if (!stat.isDirectory()) return { success: false, error: "Path is not a directory" }

    const { setStoragePath } = await import("@/lib/storage-config")
    await setStoragePath(resolved)
    return { success: true, path: resolved }
  } catch (error) {
    console.error("Error updating storage path:", error)
    return { success: false, error: "Invalid path or insufficient permissions" }
  }
}