/**
 * FileClientPage — client-side shell for the file explorer.
 *
 * Owns:
 * - Loading/error/not-found state for the current directory listing
 * - View mode (list vs. grid) persisted to localStorage
 * - Quota display
 *
 * Does NOT own: file CRUD operations (those live inside FileExplorer and
 * its sub-components).
 *
 * Note: Google Drive import is not available in this release — the OAuth
 * flow has not been implemented yet.
 */

"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircleIcon, FolderXIcon, RefreshCwIcon } from "lucide-react"
import { LayoutListIcon, LayoutGridIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { FileItem } from "@/components/files/file-utils"
import { fileRecordToItem } from "@/components/files/file-utils"
import { FileExplorer } from "@/components/files/file-explorer"
import { TrashView } from "@/components/files/trash-view"
import { listFiles, listStarred, listRecent, getQuota } from "@/lib/actions/files"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { UploadQueueProvider } from "@/components/files/upload-queue"

interface FileClientPageProps {
  initialItems: FileItem[]
  currentPath: string
  isDrivePath?: boolean
}

type LoadState =
  | { status: "loading" }
  | { status: "ok"; items: FileItem[]; refreshing?: boolean }
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


  // Load quota once on mount
  React.useEffect(() => {
    getQuota().then(setQuota).catch(() => {})
  }, [])

  // ------------------------------------------------------------------
  // Directory listing
  // ------------------------------------------------------------------

  const load = React.useCallback(async () => {
    // Use a lightweight "refreshing" flag on re-fetches so the explorer
    // stays mounted (and in-flight uploads are not killed).
    setState((prev) =>
      prev.status === "ok"
        ? { ...prev, refreshing: true }
        : { status: "loading" }
    )
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
      // verify the folder actually exists by checking the parent listing
      if (records.length === 0 && currentPath !== "") {
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
          // If parent check fails, still show empty rather than block navigation
        }
      }

      setState({ status: "ok", items: records.map(fileRecordToItem) })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Dosyalar yüklenemedi"
      if (message.includes("Session expired")) return
      setState({ status: "error", message })
    }
  }, [currentPath, view])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Re-fetch after uploads/deletes/moves dispatched by child components
  React.useEffect(() => {
    const handler = () => void load()
    window.addEventListener("wms:files:changed", handler)
    return () => window.removeEventListener("wms:files:changed", handler)
  }, [load])

  // ------------------------------------------------------------------
  // Google Drive import
  // ------------------------------------------------------------------


  // ------------------------------------------------------------------
  // Loading skeleton
  // ------------------------------------------------------------------

  if (state.status === "loading") {
    return (
      <UploadQueueProvider>
        <div className="flex flex-col gap-2 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      </UploadQueueProvider>
    )
  }

  // ------------------------------------------------------------------
  // Not-found state
  // ------------------------------------------------------------------

  if (state.status === "not-found") {
    const parentPath = currentPath.includes("/")
      ? currentPath.split("/").slice(0, -1).join("/")
      : ""

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-12 text-center">
        <FolderXIcon className="size-12 text-muted-foreground/40" />
        <div className="space-y-1">
          <p className="text-base font-medium">Klasör bulunamadı</p>
          <p className="text-sm text-muted-foreground">
            <code className="rounded bg-muted px-1 py-0.5 text-xs">{currentPath}</code> mevcut değil.
          </p>
        </div>
        <div className="flex gap-2">
          {parentPath && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/files/${parentPath}`)}
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

  // ------------------------------------------------------------------
  // Error state
  // ------------------------------------------------------------------

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

  // ------------------------------------------------------------------
  // Main render (ok state)
  // ------------------------------------------------------------------

  const usedMB = quota ? (quota.used_bytes / 1024 / 1024).toFixed(1) : null
  const usedGB = quota && quota.used_bytes > 1024 * 1024 * 1024
    ? (quota.used_bytes / 1024 / 1024 / 1024).toFixed(2)
    : null

  const isRefreshing = state.status === "ok" && !!state.refreshing

  return (
    <UploadQueueProvider>
    <div className="flex flex-col h-full relative">
      {isRefreshing && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 bg-primary/40 animate-pulse" />
      )}
      {/* Top bar: view toggle, Drive import button, quota */}
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
          {/* Drive import is not available in this release — OAuth flow not yet implemented */}

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

      {/* File list / grid */}
      <div className="flex flex-col flex-1 min-h-0 h-full">
        {view === "trash" ? (
          <TrashView />
        ) : (
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
        )}
      </div>

      {/* Drive import dialog removed — not available in this release */}
    </div>
    </UploadQueueProvider>
  )
}

export type { FileClientPageProps }
