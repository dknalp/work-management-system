"use server"

import fs from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"

const ROOT_DIR = path.join(process.cwd(), "data")

// Ensure ROOT_DIR exists
async function ensureRootDir() {
  try {
    await fs.access(ROOT_DIR)
  } catch {
    await fs.mkdir(ROOT_DIR, { recursive: true })
  }
}

function getSafePath(relativePath: string) {
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "")
  return path.join(ROOT_DIR, safePath)
}

export type FileItem = {
  name: string
  path: string
  isDirectory: boolean
  size: number
  updatedAt: string
}

export async function listFiles(
  relativePath: string = ""
): Promise<FileItem[]> {
  await ensureRootDir()
  const fullPath = getSafePath(relativePath)

  try {
    const entries = await fs.readdir(fullPath, { withFileTypes: true })
    const items = await Promise.all(
      entries.map(async (entry) => {
        const entryPath = path.join(fullPath, entry.name)
        const stats = await fs.stat(entryPath)
        const relPath = path.relative(ROOT_DIR, entryPath)

        return {
          name: entry.name,
          path: relPath,
          isDirectory: entry.isDirectory(),
          size: stats.size,
          updatedAt: stats.mtime.toISOString(),
        }
      })
    )

    // Sort: Folders first, then alphabetically
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
    revalidatePath("/files")
    return { success: true }
  } catch (error) {
    console.error("Error deleting item:", error)
    return { success: false, error: "Failed to delete item" }
  }
}

export async function renameItem(oldPath: string, newName: string) {
  const oldFullPath = getSafePath(oldPath)
  const dir = path.dirname(oldFullPath)
  const newFullPath = path.join(dir, newName)

  try {
    await fs.rename(oldFullPath, newFullPath)
    revalidatePath("/files")
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
    revalidatePath("/files")
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
    revalidatePath("/files")
    return { success: true }
  } catch (error) {
    console.error("Move error:", error)
    return { success: false, error: "Failed to move item" }
  }
}
