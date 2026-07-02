import { NextRequest, NextResponse } from "next/server"
import fs from "fs/promises"
import path from "path"
import { getStoragePath } from "@/lib/storage-config"

// This route is called by a cron job (e.g. Vercel Cron, external cron, or internal scheduler).
// Protect with a secret token so it cannot be triggered by arbitrary users.
// Set CRON_SECRET in your .env.local, e.g.: CRON_SECRET=some-random-string
const CRON_SECRET = process.env.CRON_SECRET

const TRASH_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

async function purgeExpiredTrash(): Promise<{ purged: number; errors: number }> {
  const trashDir = path.join(getStoragePath(), ".trash")
  let purged = 0
  let errors = 0

  try {
    await fs.access(trashDir)
  } catch {
    // trash dir doesn't exist — nothing to do
    return { purged: 0, errors: 0 }
  }

  const cutoff = Date.now() - TRASH_TTL_MS

  let entries: import("fs").Dirent<string>[]
  try {
    entries = await fs.readdir(trashDir, { withFileTypes: true, encoding: "utf8" })
  } catch {
    return { purged: 0, errors: 1 }
  }

  await Promise.all(
    entries
      .filter((e) => !e.name.endsWith(".meta.json"))
      .map(async (entry) => {
        const underscoreIdx = entry.name.indexOf("_")
        const ts = underscoreIdx >= 0 ? parseInt(entry.name.slice(0, underscoreIdx)) : NaN
        if (isNaN(ts) || ts >= cutoff) return

        try {
          await fs.rm(path.join(trashDir, entry.name), { recursive: true, force: true })
          await fs.unlink(path.join(trashDir, `${entry.name}.meta.json`)).catch(() => {})
          purged++
        } catch (err) {
          console.error(`purge-trash: failed to remove ${entry.name}:`, err)
          errors++
        }
      })
  )

  return { purged, errors }
}

export async function GET(req: NextRequest) {
  // Allow either: Authorization header or ?secret= query param
  const authHeader = req.headers.get("authorization")
  const secretParam = new URL(req.url).searchParams.get("secret")

  if (CRON_SECRET) {
    const provided =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : secretParam
    if (provided !== CRON_SECRET) {
      return new NextResponse("Unauthorized", { status: 401 })
    }
  }

  try {
    const result = await purgeExpiredTrash()
    console.log(`[cron/purge-trash] purged=${result.purged} errors=${result.errors}`)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[cron/purge-trash] unexpected error:", err)
    return NextResponse.json({ ok: false, error: "Internal error" }, { status: 500 })
  }
}