"use server"

import fs from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"
import { getStoragePath } from "@/lib/storage-config"

async function ensureRootDir() {
  try {
    await fs.access(getStoragePath())
  } catch {
    await fs.mkdir(getStoragePath(), { recursive: true })
  }
}

function getSafePath(relativePath: string) {
  const rootDir = getStoragePath()
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "")
  return path.join(rootDir, safePath)
}

export type FileItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  updatedAt: string
  childCount?: number
}

export async function listFiles(relativePath: string = ""): Promise<FileItem[]> {
  await ensureRootDir()
  const rootDir = getStoragePath()
  const fullPath = getSafePath(relativePath)

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const items = await Promise.all(
      entries
        .filter((e) => e.name !== ".trash") // hide trash folder
        .map(async (entry) => {
          const entryPath = path.join(fullPath, entry.name)
          const stats = await fs.stat(entryPath)
          const relPath = path.relative(rootDir, entryPath)

          let childCount: number | undefined
          if (entry.isDirectory()) {
            try {
              const children = await fs.readdir(entryPath)
              childCount = children.filter((c) => c !== ".trash").length
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
  const rootDir = getStoragePath()
  const trashDir = path.join(rootDir, ".trash")
  const fullPath = getSafePath(relativePath)
  const fileName = path.basename(relativePath)

  try {
    await fs.mkdir(trashDir, { recursive: true })
    const dest = path.join(trashDir, `${Date.now()}_${fileName}`)
    await fs.rename(fullPath, dest)
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error moving to trash:", error)
    return { success: false, error: "Failed to move to trash" }
  }
}

export async function renameItem(oldPath: string, newName: string) {
  const oldFullPath = getSafePath(oldPath)
  const dir = path.dirname(oldFullPath)
  const newFullPath = path.join(dir, newName)

  try {
    await fs.rename(oldFullPath, newFullPath)
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error renaming item:", error)
    return { success: false, error: "Failed to rename item" }
  }
}

export async function createFolder(parentPath: string, name: string) {
  const fullPath = path.join(getSafePath(parentPath), name)
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
  const safeSourcePath = getSafePath(sourcePath)
  const fileName = path.basename(sourcePath)
  const safeTargetDirPath = getSafePath(targetDirPath)
  const destinationPath = path.join(safeTargetDirPath, fileName)

  try {
    await fs.access(safeSourcePath)
    await fs.rename(safeSourcePath, destinationPath)
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Move error:", error)
    return { success: false, error: "Failed to move item" }
  }
}

export async function copyItem(sourcePath: string, targetDirPath: string) {
  const safeSourcePath = getSafePath(sourcePath)
  const fileName = path.basename(sourcePath)
  const safeTargetDirPath = getSafePath(targetDirPath)
  const destinationPath = path.join(safeTargetDirPath, fileName)

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

export async function listFilesRecursive(query: string): Promise<FileItem[]> {
  await ensureRootDir()
  const rootDir = getStoragePath()
  const results: FileItem[] = []

  async function walk(dir: string) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true, encoding: "utf8" })
      await Promise.all(
        entries.map(async (entry) => {
          const name = entry.name as string
          if (name === ".trash") return
          const entryPath = path.join(dir, name)
          if (name.toLowerCase().includes(query.toLowerCase())) {
            const stats = await fs.stat(entryPath)
            results.push({
              name,
              path: path.relative(rootDir, entryPath),
              isDirectory: entry.isDirectory(),
              size: stats.size,
              updatedAt: stats.mtime.toISOString(),
            })
          }
          if (entry.isDirectory()) await walk(entryPath)
        })
      )
    } catch {
      return
    }
  }

  await walk(rootDir)
  return results
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
            if (isDir) await walk(entryPath)
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

export async function getStorageConfig() {
  const { getStorageConfig: _get } = await import("@/lib/storage-config")
  return _get()
}

export async function updateStoragePath(newPath: string) {
  "use server"
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