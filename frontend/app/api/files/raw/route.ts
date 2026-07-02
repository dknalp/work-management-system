import { NextRequest, NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import { getStoragePath } from "@/lib/storage-config"
import { isAuthenticated } from "@/lib/server-auth"
import crypto from "crypto"

// Extensions that must be forced to download to prevent XSS / script execution
const FORCE_DOWNLOAD_EXTS = new Set([
  ".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx",
  ".php", ".sh", ".bash", ".zsh", ".py", ".rb", ".pl", ".lua",
  ".svg", ".xml", ".xhtml",
])

function getSafePath(relativePath: string): string | null {
  const rootDir = getStoragePath()
  const fullPath = path.resolve(rootDir, relativePath)
  if (fullPath !== rootDir && !fullPath.startsWith(rootDir + path.sep)) {
    return null
  }
  return fullPath
}

function getContentType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/plain; charset=utf-8",
    ".json": "text/plain; charset=utf-8",
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".avi": "video/x-msvideo",
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".flac": "audio/flac",
    ".aac": "audio/aac",
    ".zip": "application/zip",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }
  return mimeTypes[ext.toLowerCase()] || "application/octet-stream"
}

export async function GET(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const relativePath = searchParams.get("path")

  if (!relativePath?.trim()) {
    return new NextResponse("Path is required", { status: 400 })
  }

  const fullPath = getSafePath(relativePath)
  if (!fullPath) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  let stats: fs.Stats
  try {
    stats = await fs.promises.stat(fullPath)
    if (!stats.isFile()) {
      return new NextResponse("Path is not a file", { status: 400 })
    }
  } catch {
    return new NextResponse("File not found", { status: 404 })
  }

  const ext = path.extname(fullPath)
  const contentType = getContentType(ext)
  const fileSize = stats.size
  const mtime = stats.mtime.toUTCString()
  const etag = `"${crypto.createHash("md5").update(`${fullPath}-${stats.mtimeMs}-${fileSize}`).digest("hex")}"`

  // 304 Not Modified checks
  const ifNoneMatch = request.headers.get("if-none-match")
  const ifModifiedSince = request.headers.get("if-modified-since")
  if (ifNoneMatch === etag) {
    return new NextResponse(null, { status: 304 })
  }
  if (ifModifiedSince && new Date(ifModifiedSince) >= stats.mtime) {
    return new NextResponse(null, { status: 304 })
  }

  const fileName = path.basename(fullPath)
  const forceDownload = FORCE_DOWNLOAD_EXTS.has(ext.toLowerCase())
  const commonHeaders: Record<string, string> = {
    "Content-Type": forceDownload ? "application/octet-stream" : contentType,
    "Content-Disposition": forceDownload
      ? `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      : `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    "Accept-Ranges": "bytes",
    "ETag": etag,
    "Last-Modified": mtime,
    "Cache-Control": "private, no-cache",
    "X-Content-Type-Options": "nosniff",
  }

  // Range request (video seek, resume download)
  const rangeHeader = request.headers.get("range")
  if (rangeHeader) {
    // RFC 7233: bytes=<start>-<end> or bytes=-<suffix>
    const suffixMatch = rangeHeader.match(/^bytes=-(\d+)$/)
    if (suffixMatch) {
      const suffixLen = parseInt(suffixMatch[1])
      const start = Math.max(0, fileSize - suffixLen)
      const end = fileSize - 1
      const chunkSize = end - start + 1
      const nodeStream = fs.createReadStream(fullPath, { start, end })
      const webStream = new ReadableStream({
        start(controller) {
          nodeStream.on("data", (chunk) => controller.enqueue(chunk))
          nodeStream.on("end", () => controller.close())
          nodeStream.on("error", (err) => controller.error(err))
        },
        cancel() { nodeStream.destroy() },
      })
      return new NextResponse(webStream, {
        status: 206,
        headers: {
          ...commonHeaders,
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Content-Length": chunkSize.toString(),
        },
      })
    }

    const match = rangeHeader.match(/^bytes=(\d+)-(\d*)$/)
    if (!match) {
      return new NextResponse("Invalid Range", { status: 416 })
    }
    const start = parseInt(match[1])
    const end = match[2] ? parseInt(match[2]) : fileSize - 1
    const clampedEnd = Math.min(end, fileSize - 1)

    if (start > clampedEnd || start >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      })
    }

    const chunkSize = clampedEnd - start + 1
    const nodeStream = fs.createReadStream(fullPath, { start, end: clampedEnd })
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => controller.enqueue(chunk))
        nodeStream.on("end", () => controller.close())
        nodeStream.on("error", (err) => controller.error(err))
      },
      cancel() {
        nodeStream.destroy()
      },
    })

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${clampedEnd}/${fileSize}`,
        "Content-Length": chunkSize.toString(),
      },
    })
  }

  // Full file — stream it
  const nodeStream = fs.createReadStream(fullPath)
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => controller.enqueue(chunk))
      nodeStream.on("end", () => controller.close())
      nodeStream.on("error", (err) => controller.error(err))
    },
    cancel() {
      nodeStream.destroy()
    },
  })

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": fileSize.toString(),
    },
  })
}