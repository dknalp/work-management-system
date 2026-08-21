"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircleIcon, FolderXIcon, RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { LayoutListIcon, LayoutGridIcon } from "lucide-react"
import type { FileItem } from "@/components/files/file-utils"
import { fileRecordToItem } from "@/components/files/file-utils"
import { FileExplorer } from "@/components/files/file-explorer"
import { TrashView } from "@/components/files/trash-view"
import { listFiles, listStarred, listRecent, getQuota, importFromDrive } from "@/lib/actions/files"
import { API_BASE_URL } from "@/lib/api"
import { tokenStorage } from "@/lib/auth"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useDrivePicker } from "@/hooks/use-drive-picker"
import { toast } from "sonner"
import { HardDriveDownloadIcon } from "lucide-react"

interface FileClientPageProps {
  initialItems: FileItem[]
  currentPath: string
  isDrivePath?: boolean
}

type LoadState =
  | { status: "loading" }
  | { status: "ok"; items: FileItem[] }
  | { status: "error"; message: string }
  | { status: "not-found" }

export function FileClientPage({ currentPath }: FileClientPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const view = searchParams.get("view") // "starred" | "recent" | "trash" | null
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("wms:files-view", "list")
  const [showPreview, setShowPreview] = React.useState(false)
  const [state, setState] = React.useState<LoadState>({ status: "loading" })
  const [quota, setQuota] = React.useState<{ used_bytes: number; file_count: number } | null>(null)
  const [driveImporting, setDriveImporting] = React.useState(false)
  const [folderProgress, setFolderProgress] = React.useState<{
    folder: string; done: number; total: number
  } | null>(null)
  const { openPicker } = useDrivePicker()

  // Load quota once on mount
  React.useEffect(() => {
    getQuota().then(setQuota).catch(() => {})
  }, [])

  const handleDriveImport = React.useCallback(async () => {
    setDriveImporting(true)
    try {
      const result = await openPicker()
      if (!result || result.items.length === 0) return

      const folders = result.items.filter((i) => i.isFolder)
      const files   = result.items.filter((i) => !i.isFolder)

      // ── Import individual files (non-folder) in parallel ──
      if (files.length > 0) {
        const label = files.length === 1 ? `"${files[0].fileName}"` : `${files.length} dosya`
        toast.loading(`${label} Drive'dan içe aktarılıyor...`, { id: "drive-import" })
        await Promise.all(files.map((item) => importFromDrive(item.fileId, result.accessToken, currentPath, false)))
        toast.success(`${label} başarıyla içe aktarıldı`, { id: "drive-import" })
        window.dispatchEvent(new Event("wms:files:changed"))
      }

      // ── Import folders via SSE stream ──
      for (const folder of folders) {
        const token = tokenStorage.getAccess()
        const res = await fetch(`${API_BASE_URL}/api/v1/files/import-folder-stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            folder_id: folder.fileId,
            access_token: result.accessToken,
            parent_path: currentPath,
          }),
        })

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { detail?: string }).detail ?? "Klasör aktarımı başarısız")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            try {
              const event = JSON.parse(line.slice(6)) as {
                type: string; total?: number; done?: number; folder?: string
                imported?: number; skipped?: number; errors?: string[]; message?: string
              }

              if (event.type === "start") {
                setFolderProgress({ folder: event.folder ?? folder.fileName, done: 0, total: event.total ?? 0 })
              } else if (event.type === "progress") {
                setFolderProgress((p) => p ? { ...p, done: event.done ?? p.done } : null)
              } else if (event.type === "done") {
                setFolderProgress(null)
                toast.success(
                  `📁 "${folder.fileName}" — ${event.imported} dosya aktarıldı` +
                  (event.skipped ? `, ${event.skipped} atlandı` : "") +
                  (event.errors?.length ? `, ${event.errors.length} hata` : ""),
                )
                window.dispatchEvent(new Event("wms:files:changed"))
              } else if (event.type === "error") {
                setFolderProgress(null)
                throw new Error(event.message ?? "Klasör aktarımı başarısız")
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      }
    } catch (err) {
      setFolderProgress(null)
      const msg = err instanceof Error ? err.message : "İçe aktarma başarısız"
      toast.error(msg, { id: "drive-import" })
    } finally {
      setDriveImporting(false)
    }
  }, [openPicker, currentPath])

  const load = React.useCallback(async () => {
    setState({ status: "loading" })
    try {
      if (view === "starred") {
        const records = await listStarred()
        setState({ status: "ok", items: records.map(fileRecordToItem) })
        return
      }
      if (view === "recent") {
        const records = await listRecent()
        setState({ status: "ok", items: records.map(fileRecordToItem) })
        return
      }
      if (view === "trash") {
        // TrashView handles its own fetching
        setState({ status: "ok", items: [] })
        return
      }

      // Normal path fetch
      const records = await listFiles(currentPath)

      // Path validation: if we're inside a subfolder and got 0 results,
      // verify the folder actually exists by checking the parent
      if (records.length === 0 && currentPath !== "") {
        // Try to find this path in its parent listing
        const parentPath = currentPath.includes("/")
          ? currentPath.split("/").slice(0, -1).join("/")
          : ""
        try {
          const parentRecords = await listFiles(parentPath)
          const folderExists = parentRecords.some(
            (r) => r.path === currentPath && r.type === "folder"
          )
          if (!folderExists) {
            setState({ status: "not-found" })
            return
          }
        } catch {
          // If parent check fails, still show empty (don't block)
        }
      }

      setState({ status: "ok", items: records.map(fileRecordToItem) })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Dosyalar yüklenemedi"
      // Session expired → redirect to login
      if (message.includes("Session expired")) {
        return
      }
      setState({ status: "error", message })
    }
  }, [currentPath, view])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Re-fetch after uploads/deletes/moves
  React.useEffect(() => {
    const handler = () => load()
    window.addEventListener("wms:files:changed", handler)
    return () => window.removeEventListener("wms:files:changed", handler)
  }, [load])

  if (view === "trash") {
    return <TrashView />
  }

  if (state.status === "loading") {
    return (
      <div className="flex flex-col gap-3 p-6">
        <div className="flex items-center gap-2 h-8">
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
          <Skeleton className="h-7 w-24 rounded-md" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-7 w-32 rounded-md" />
          </div>
        </div>
        <div className="mt-2 overflow-hidden rounded-xl border border-border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/50 px-6 py-3 last:border-0">
              <Skeleton className="size-8 rounded-md" />
              <Skeleton className="h-4 w-48 rounded" />
              <div className="ml-auto flex gap-8">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-4 w-20 rounded" />
                <Skeleton className="h-4 w-24 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (state.status === "not-found") {
    const parentPath = currentPath.includes("/")
      ? currentPath.split("/").slice(0, -1).join("/")
      : ""
    const folderName = currentPath.split("/").pop() ?? currentPath
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <FolderXIcon className="size-16 text-muted-foreground/20" />
        <div className="space-y-1">
          <p className="text-base font-medium">
            &quot;{folderName}&quot; klasörü bulunamadı
          </p>
          <p className="text-sm text-muted-foreground">
            Bu klasör mevcut değil veya silinmiş olabilir.
          </p>
        </div>
        <div className="flex gap-2 mt-2">
          {parentPath !== currentPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(parentPath ? `/files/${parentPath}` : "/files")}
            >
              Üst Klasöre Git
            </Button>
          )}
          <Button
            variant="default"
            size="sm"
            onClick={() => router.push("/files")}
          >
            Ana Klasöre Dön
          </Button>
        </div>
      </div>
    )
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertCircleIcon className="size-12 text-destructive/40" />
        <div className="space-y-1">
          <p className="text-base font-medium">Dosyalar yüklenemedi</p>
          <p className="text-sm text-muted-foreground">{state.message}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          className="gap-2"
        >
          <RefreshCwIcon className="size-3.5" />
          Tekrar Dene
        </Button>
      </div>
    )
  }

  const usedMB = quota ? (quota.used_bytes / 1024 / 1024).toFixed(1) : null
  const usedGB = quota && quota.used_bytes > 1024 * 1024 * 1024
    ? (quota.used_bytes / 1024 / 1024 / 1024).toFixed(2)
    : null

  return (
    <div className="flex flex-col h-full">
      {/* Top bar: view toggle + quota */}
      <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Liste görünümü"
          >
            <LayoutListIcon className="size-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            title="Izgara görünümü"
          >
            <LayoutGridIcon className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Drive import button */}
          <button
            onClick={handleDriveImport}
            disabled={driveImporting}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Google Drive'dan dosya içe aktar"
          >
            <HardDriveDownloadIcon className="size-3.5" />
            <span>{"Drive'dan İçe Aktar"}</span>
          </button>

          {/* Folder import progress bar */}
          {folderProgress && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-muted-foreground/50">·</span>
              <span className="max-w-[120px] truncate" title={folderProgress.folder}>
                📁 {folderProgress.folder}
              </span>
              <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300"
                  style={{
                    width: folderProgress.total > 0
                      ? `${Math.round((folderProgress.done / folderProgress.total) * 100)}%`
                      : "0%"
                  }}
                />
              </div>
              <span>{folderProgress.done}/{folderProgress.total}</span>
            </div>
          )}

          {quota && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-muted-foreground/50">·</span>
              <span>{usedGB ? `${usedGB} GB` : `${usedMB} MB`} kullanıldı</span>
              <span className="text-muted-foreground/50">·</span>
              <span>{quota.file_count} dosya</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col flex-1 min-h-0 h-full">
        <FileExplorer
          items={state.items}
          currentPath={currentPath}
          viewMode={viewMode}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview((v) => !v)}
          searchQuery=""
          searchResults={null}
          isSearching={false}
          onFilesChanged={load}
        />
      </div>
    </div>
  )
}

// Export setters so FileLayout toolbar can trigger search
export type { FileClientPageProps }