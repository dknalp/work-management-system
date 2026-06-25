import fs from "fs"
import path from "path"

const CONFIG_FILE = path.join(process.cwd(), "config", "storage.json")
// Default: proje kökü altında data/ (frontend/../data)
const DEFAULT_PATH = path.resolve(process.cwd(), "../data")

export function getStoragePath(): string {
  if (process.env.FILE_STORAGE_PATH) {
    return path.isAbsolute(process.env.FILE_STORAGE_PATH)
      ? process.env.FILE_STORAGE_PATH
      : path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH)
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
    const cfg = JSON.parse(raw)
    if (cfg.storagePath && typeof cfg.storagePath === "string") {
      return path.isAbsolute(cfg.storagePath)
        ? cfg.storagePath
        : path.resolve(process.cwd(), cfg.storagePath)
    }
  } catch {
    // config file doesn't exist yet — use default
  }
  return DEFAULT_PATH
}

export async function setStoragePath(newPath: string): Promise<void> {
  const resolved = path.isAbsolute(newPath) ? newPath : path.resolve(process.cwd(), newPath)
  await fs.promises.mkdir(path.dirname(CONFIG_FILE), { recursive: true })
  await fs.promises.writeFile(CONFIG_FILE, JSON.stringify({ storagePath: resolved }, null, 2))
}

export async function getStorageConfig(): Promise<{
  path: string
  source: "env" | "config" | "default"
}> {
  if (process.env.FILE_STORAGE_PATH) {
    return {
      path: path.isAbsolute(process.env.FILE_STORAGE_PATH)
        ? process.env.FILE_STORAGE_PATH
        : path.resolve(process.cwd(), process.env.FILE_STORAGE_PATH),
      source: "env",
    }
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8")
    const cfg = JSON.parse(raw)
    if (cfg.storagePath && typeof cfg.storagePath === "string") {
      return {
        path: path.isAbsolute(cfg.storagePath)
          ? cfg.storagePath
          : path.resolve(process.cwd(), cfg.storagePath),
        source: "config",
      }
    }
  } catch {
    // not set yet
  }
  return { path: DEFAULT_PATH, source: "default" }
}