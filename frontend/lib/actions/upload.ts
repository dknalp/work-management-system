"use server"

import fs from "fs/promises"
import path from "path"
import { revalidatePath } from "next/cache"

const ROOT_DIR = path.join(process.cwd(), "data")

function getSafePath(relativePath: string) {
  const safePath = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "")
  return path.join(ROOT_DIR, safePath)
}

export async function uploadFile(formData: FormData) {
  const file = formData.get("file") as File
  const currentPath = formData.get("path") as string

  if (!file) return { success: false, error: "No file provided" }

  const fullPath = path.join(getSafePath(currentPath), file.name)

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(fullPath, buffer)
    revalidatePath("/files")
    return { success: true }
  } catch (error) {
    console.error("Error uploading file:", error)
    return { success: false, error: "Upload failed" }
  }
}
