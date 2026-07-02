import { NextResponse } from "next/server"
import { execFile } from "child_process"
import { promisify } from "util"
import { getStoragePath } from "@/lib/storage-config"
import { isAuthenticated } from "@/lib/server-auth"

const execFileAsync = promisify(execFile)

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const storagePath = getStoragePath()
    // Use execFile (not execSync/exec) so storagePath is passed as a safe argument,
    // never interpolated into a shell string — prevents command injection.
    // -B1 gives sizes in bytes; -P for POSIX portable output.
    const { stdout } = await execFileAsync("df", ["-B1", "-P", storagePath])
    const lines = stdout.trim().split("\n")
    const parts = lines[1].trim().split(/\s+/)
    const total = parseInt(parts[1], 10)
    const used = parseInt(parts[2], 10)
    const available = parseInt(parts[3], 10)
    return NextResponse.json({ total, used, available })
  } catch {
    return NextResponse.json({ total: 0, used: 0, available: 0 })
  }
}