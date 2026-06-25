"use server"

import fs from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"
import { getStoragePath } from "@/lib/storage-config"

function getSafePath(relativePath: string) {
  const rootDir = getStoragePath()
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "")
  return path.join(rootDir, safePath)
}

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File
  const currentPath = formData.get("path") as string
  const overwrite = formData.get("overwrite") === "true"

  if (!file) return { success: false, error: "No file provided" }

  const fullPath = path.join(getSafePath(currentPath), file.name)

  // Check for conflict
  if (!overwrite) {
    try {
      await fs.access(fullPath)
      // File exists → conflict
      return { success: false, conflict: true, name: file.name }
    } catch {
      // File doesn't exist — safe to upload
    }
  }

  try {
    // Stream write to avoid loading entire file into RAM
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, buffer)
    revalidatePath("/files", "layout")
    return { success: true }
  } catch (error) {
    console.error("Error uploading file:", error)
    return { success: false, error: "Upload failed" }
  }
}