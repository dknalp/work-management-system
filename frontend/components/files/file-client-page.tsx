"use client"

import * as React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { FileItem, SearchOptions, SearchResult, searchFiles } from "@/lib/actions/files"
import { listDriveFiles, getDriveConnectionStatus, searchDriveFiles } from "@/lib/actions/drive"
import { FileLayout } from "./file-layout"
import { FileExplorer } from "./file-explorer"
import { FileBreadcrumbs } from "./file-breadcrumbs"
import { FileToolbar } from "./file-toolbar"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { cn } from "@/lib/utils"
import { HardDriveIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { usePermissions } from "@/contexts/permissions-context"
import { AccessDenied } from "@/components/auth/access-denied"
import { FileDropZone } from "./file-drop-zone"

type SourceFilter = "all" | "disk" | "drive"

interface FileClientPageProps {
  items: FileItem[]
  currentPath: string
  isDrivePath?: boolean
}

function DriveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill="currentColor">
      <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
    </svg>
  )
}

export function FileClientPage({ items: diskItems, currentPath, isDrivePath = false }: FileClientPageProps) {
  const { permissions, loading: permLoading } = usePermissions()
  const searchParams = useSearchParams()
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("wms:files:viewMode", "list")
  const [showPreview, setShowPreview] = useLocalStorage<boolean>("wms:files:showPreview", false)
  const router = useRouter()
  const sourceParam = searchParams.get("source")
  const initialSource: SourceFilter = isDrivePath
    ? "drive"
    : sourceParam === "disk" ? "disk"
    : sourceParam === "drive" ? "drive"
    : "all"
  const [sourceFilter, setSourceFilter] = React.useState<SourceFilter>(initialSource)

  const handleSourceChange = (src: SourceFilter) => {
    setSourceFilter(src)
    const params = new URLSearchParams(searchParams.toString())
    if (src === "all") params.delete("source")
    else params.set("source", src)
    const qs = params.toString()
    router.replace(`/files${currentPath ? `/${currentPath}` : ""}${qs ? `?${qs}` : ""}`)
  }
  const [driveItems, setDriveItems] = React.useState<FileItem[]>([])
  const [driveConnected, setDriveConnected] = React.useState(false)
  const [driveLoading, setDriveLoading] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchResult[] | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)

  React.useEffect(() => {
    getDriveConnectionStatus().then((status) => {
      setDriveConnected(status.connected)
      if (status.connected) {
        setDriveLoading(true)
        listDriveFiles(isDrivePath ? currentPath : "").then((files) => {
          setDriveItems(files)
          setDriveLoading(false)
        })
      }
    })
  }, [currentPath, isDrivePath])

  const displayItems = React.useMemo(() => {
    if (sourceFilter === "disk") return diskItems
    if (sourceFilter === "drive") return driveItems
    const taggedDisk = diskItems.map((i) => (i.source ? i : { ...i, source: "disk" as const }))
    return [...taggedDisk, ...driveItems]
  }, [diskItems, driveItems, sourceFilter])

  const handleSearch = async (opts: SearchOptions) => {
    setIsSearching(true)
    setSearchResults(null)
    try {
      const [diskSettled, driveSettled] = await Promise.allSettled([
        searchFiles(opts),
        driveConnected ? searchDriveFiles(opts.query) : Promise.resolve([]),
      ])
      const diskResults = diskSettled.status === "fulfilled" ? diskSettled.value : []
      const driveMatches = driveSettled.status === "fulfilled" ? driveSettled.value : []
      const driveResults: SearchResult[] = driveMatches.map((item) => ({
        ...item,
        matchType: "name" as const,
      }))
      setSearchResults([...diskResults, ...driveResults])
    } finally {
      setIsSearching(false)
    }
  }

  const handleQueryChange = (q: string) => setSearchQuery(q)
  const handleClearSearch = () => {
    setSearchQuery("")
    setSearchResults(null)
    setIsSearching(false)
  }

  if (permLoading) return null
  if (!permissions.includes("files:view")) return <AccessDenied />

  return (
    <FileLayout
      currentPath={currentPath}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview((p) => !p)}
      onSearch={handleSearch}
      onQueryChange={handleQueryChange}
      onClearSearch={handleClearSearch}
      isSearching={isSearching}
      hasSearchResults={searchResults !== null}
    >
      <FileDropZone currentPath={currentPath} disabled={isDrivePath}>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Breadcrumbs row — source filter pills on the right, toolbar at far right */}
        <div className="flex items-center justify-between border-b border-border/50 bg-background/30 px-6 py-2">
          <FileBreadcrumbs currentPath={currentPath} isDrivePath={isDrivePath} />

          <div className="flex items-center gap-2">
            {/* Compact source filter — only on disk/all views */}
            {!isDrivePath && (
              <div className="flex items-center rounded-md border bg-muted/30 p-0.5">
                <button
                  onClick={() => handleSourceChange("all")}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    sourceFilter === "all"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Tümü
                </button>
                <button
                  onClick={() => handleSourceChange("disk")}
                  className={cn(
                    "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    sourceFilter === "disk"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <HardDriveIcon className="size-3" />
                  Sunucu
                </button>
                {driveConnected ? (
                  <button
                    onClick={() => handleSourceChange("drive")}
                    className={cn(
                      "flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors",
                      sourceFilter === "drive"
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <DriveIcon />
                    Drive
                  </button>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex cursor-not-allowed items-center gap-1 rounded px-2.5 py-1 text-xs font-medium text-muted-foreground/40">
                          <DriveIcon />
                          Drive
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        Admin tarafından bağlanmadı
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {driveLoading && (
                  <div className="ml-1 size-3 animate-spin rounded-full border-2 border-muted border-t-primary" />
                )}
              </div>
            )}

            <FileToolbar currentPath={isDrivePath ? "" : currentPath} isDriveView={isDrivePath} />
          </div>
        </div>

        {/* File explorer */}
        <FileExplorer
          items={displayItems}
          currentPath={isDrivePath ? currentPath : (sourceFilter === "drive" ? "" : currentPath)}
          sourceFilter={sourceFilter}
          viewMode={viewMode}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview((p) => !p)}
          searchQuery={searchQuery}
          searchResults={searchResults}
          isSearching={isSearching}
          onClearSearch={handleClearSearch}
        />
      </div>
      </FileDropZone>
    </FileLayout>
  )
}