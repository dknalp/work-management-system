import { NextRequest, NextResponse } from "next/server"
import { getDriveFileMeta, getDriveDownloadStream } from "@/lib/actions/drive"
import { isAuthenticated } from "@/lib/server-auth"
import { Readable } from "stream"

// Drive file IDs are alphanumeric with dashes/underscores, typically 25-44 chars
const DRIVE_FILE_ID_RE = /^[a-zA-Z0-9_-]{10,100}$/

// MIME types that must never be served inline to prevent XSS
const FORCE_DOWNLOAD_MIME = new Set([
  "text/html",
  "application/xhtml+xml",
  "image/svg+xml",
  "text/javascript",
  "application/javascript",
])

export async function GET(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get("id")
  const download = searchParams.get("download") === "1"

  if (!fileId || !DRIVE_FILE_ID_RE.test(fileId)) {
    return NextResponse.json({ error: "Invalid file ID" }, { status: 400 })
  }

  try {
    const meta = await getDriveFileMeta(fileId)
    if (!meta) {
      return NextResponse.json({ error: "File not found or Drive not connected" }, { status: 404 })
    }

    const result = await getDriveDownloadStream(fileId)
    if (!result) {
      return NextResponse.json({ error: "File could not be downloaded" }, { status: 502 })
    }

    const { stream, mimeType, name } = result
    const safeMime = FORCE_DOWNLOAD_MIME.has(mimeType) ? "application/octet-stream" : mimeType
    const forceDownload = download || FORCE_DOWNLOAD_MIME.has(mimeType)

    // Convert Node.js readable stream to Web ReadableStream
    const webStream = Readable.toWeb(stream as Readable) as ReadableStream

    const headers = new Headers()
    headers.set("Content-Type", safeMime)
    headers.set(
      "Content-Disposition",
      forceDownload
        ? `attachment; filename*=UTF-8''${encodeURIComponent(name)}`
        : `inline; filename*=UTF-8''${encodeURIComponent(name)}`
    )
    // Drive files can change; no-cache forces revalidation without disabling caching
    headers.set("Cache-Control", "private, no-cache")
    headers.set("X-Content-Type-Options", "nosniff")

    return new NextResponse(webStream, { headers })
  } catch (err) {
    console.error("Drive raw proxy error:", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}