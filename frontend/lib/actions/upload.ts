"use server"

import fs from "fs"
import fsp from "fs/promises"
import path from "path"
import { Writable } from "stream"
import { revalidatePath } from "next/cache"
import { getStoragePath } from "@/lib/storage-config"
import { requireAuth } from "@/lib/server-auth"

function getSafePath(relativePath: string): string {
  const rootDir = getStoragePath()
  const fullPath = path.resolve(rootDir, relativePath)
  if (fullPath !== rootDir && !fullPath.startsWith(rootDir + path.sep)) return rootDir
  return fullPath
}

function sanitizeFileName(name: string): string {
  return name
    .replace(/[\x00/\\]/g, "")  // remove null bytes and path separators
    .replace(/\.{2,}/g, ".")     // collapse .. sequences
    .trim()
    .slice(0, 255)
}

export async function uploadFile(formData: FormData) {
  await requireAuth()

  const file = formData.get("file") as File
  const currentPath = formData.get("path") as string
  const overwrite = formData.get("overwrite") === "true"

  if (!file) return { success: false, error: "No file provided" }

  const safeName = sanitizeFileName(file.name)
  if (!safeName) return { success: false, error: "Invalid file name" }

  const fullPath = path.join(getSafePath(currentPath), safeName)

  // Check for conflict
  if (!overwrite) {
    try {
      await fsp.access(fullPath)
      return { success: false, conflict: true, name: safeName }
    } catch {
      // File doesn't exist — safe to upload
    }
  }

  try {
    await fsp.mkdir(path.dirname(fullPath), { recursive: true })

    // Stream directly to disk instead of buffering entire file in RAM
    const writeStream = fs.createWriteStream(fullPath)
    const nodeWritable = Writable.toWeb(writeStream)
    await file.stream().pipeTo(nodeWritable)

    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error uploading file:", error)
    // Clean up partial write
    await fsp.unlink(fullPath).catch(() => {})
    return { success: false, error: "Upload failed" }
  }
}