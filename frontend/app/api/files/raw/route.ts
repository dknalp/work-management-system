import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"

const ROOT_DIR = path.resolve(process.cwd(), "data")

function getSafePath(relativePath: string): string | null {
  const fullPath = path.resolve(ROOT_DIR, relativePath)
  if (fullPath !== ROOT_DIR && !fullPath.startsWith(ROOT_DIR + path.sep)) {
    return null
  }
  return fullPath
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const relativePath = searchParams.get("path")

  if (!relativePath || !relativePath.trim()) {
    return new NextResponse("Path is required", { status: 400 })
  }

  const fullPath = getSafePath(relativePath)

  if (!fullPath) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  try {
    const stats = await fs.stat(fullPath)
    if (!stats.isFile()) {
      return new NextResponse("Path is not a file", { status: 400 })
    }

    const fileBuffer = await fs.readFile(fullPath)

    // Determine content type
    const ext = path.extname(fullPath).toLowerCase()
    const contentType = getContentType(ext)

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": contentType,
        "Content-Length": stats.size.toString(),
      },
    })
  } catch (error) {
    console.error("File error:", error)
    return new NextResponse("File not found", { status: 404 })
  }
}

function getContentType(ext: string) {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".json": "application/json",
    ".js": "application/javascript",
    ".ts": "application/typescript",
    ".css": "text/css",
    ".html": "text/html",
  }
  return mimeTypes[ext] || "application/octet-stream"
}
