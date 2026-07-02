import { NextRequest, NextResponse } from "next/server"
import path from "path"
import fs from "fs"
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const archiver = require("archiver") as (format: string, options?: any) => import("archiver").Archiver
import { Readable } from "stream"
import { getStoragePath } from "@/lib/storage-config"
import { isAuthenticated } from "@/lib/server-auth"

function getSafePath(relativePath: string): string | null {
  const rootDir = getStoragePath()
  const fullPath = path.resolve(rootDir, relativePath)
  if (fullPath !== rootDir && !fullPath.startsWith(rootDir + path.sep)) return null
  return fullPath
}

export async function POST(request: NextRequest) {
  if (!(await isAuthenticated())) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  let paths: string[]
  try {
    const body = await request.json()
    paths = body.paths
    if (!Array.isArray(paths) || paths.length === 0) throw new Error()
  } catch {
    return new NextResponse("Invalid request", { status: 400 })
  }

  // Validate all paths (files and directories)
  const resolvedPaths: { full: string; archiveName: string; isDir: boolean }[] = []
  const seenNames = new Map<string, number>()
  for (const rel of paths) {
    const full = getSafePath(rel)
    if (!full) return new NextResponse("Forbidden", { status: 403 })
    let isDir = false
    try {
      const stat = fs.statSync(full)
      isDir = stat.isDirectory()
      if (!stat.isFile() && !isDir) continue
    } catch {
      continue
    }
    // Use full relative path as archive name to avoid duplicate-name collisions
    let archiveName = rel.replace(/\\/g, "/")
    // De-duplicate if two entries somehow resolve to the same archive path
    const count = seenNames.get(archiveName) ?? 0
    seenNames.set(archiveName, count + 1)
    if (count > 0) {
      const ext = isDir ? "" : path.extname(archiveName)
      const base = archiveName.slice(0, archiveName.length - ext.length)
      archiveName = `${base} (${count})${ext}`
    }
    resolvedPaths.push({ full, archiveName, isDir })
  }

  if (resolvedPaths.length === 0) {
    return new NextResponse("No valid items", { status: 400 })
  }

  const archive = archiver("zip", { zlib: { level: 5 } })

  for (const { full, archiveName, isDir } of resolvedPaths) {
    if (isDir) {
      // archive.directory recursively adds all contents under archiveName/
      archive.directory(full, archiveName)
    } else {
      archive.file(full, { name: archiveName })
    }
  }

  archive.finalize()

  const nodeReadable = archive as unknown as NodeJS.ReadableStream
  const webStream = new ReadableStream({
    start(controller) {
      Readable.from(nodeReadable).on("data", (chunk) => controller.enqueue(chunk))
      nodeReadable.on("end", () => controller.close())
      nodeReadable.on("error", (err) => controller.error(err))
    },
  })

  const firstName = resolvedPaths.length === 1
    ? path.basename(resolvedPaths[0].archiveName)
    : null
  const fileName = firstName ? `${firstName}.zip` : "download.zip"

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      "Cache-Control": "no-store",
    },
  })
}