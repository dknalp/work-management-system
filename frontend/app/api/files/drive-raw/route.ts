import { NextRequest, NextResponse } from "next/server"
import { getDriveFileMeta, getDriveDownloadStream } from "@/lib/actions/drive"
import { Readable } from "stream"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const fileId = searchParams.get("id")
  const download = searchParams.get("download") === "1"

  if (!fileId) {
    return NextResponse.json({ error: "id parametresi gerekli" }, { status: 400 })
  }

  try {
    const meta = await getDriveFileMeta(fileId)
    if (!meta) {
      return NextResponse.json({ error: "Dosya bulunamadı veya bağlantı yok" }, { status: 404 })
    }

    const result = await getDriveDownloadStream(fileId)
    if (!result) {
      return NextResponse.json({ error: "Dosya indirilemedi" }, { status: 502 })
    }

    const { stream, mimeType, name } = result

    // Convert Node.js readable stream to Web ReadableStream
    const webStream = Readable.toWeb(stream as Readable) as ReadableStream

    const headers = new Headers()
    headers.set("Content-Type", mimeType)
    headers.set(
      "Content-Disposition",
      download
        ? `attachment; filename="${encodeURIComponent(name)}"`
        : `inline; filename="${encodeURIComponent(name)}"`
    )
    headers.set("Cache-Control", "private, max-age=300")

    return new NextResponse(webStream, { headers })
  } catch (err) {
    console.error("Drive raw proxy error:", err)
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 })
  }
}