"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  FolderIcon,
  GripVerticalIcon,
  HardDriveIcon,
  LayoutGridIcon,
  ListIcon,
  PanelRightIcon,
  PinOffIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchOptions } from "@/lib/actions/files"
import { usePinnedFolders } from "@/hooks/use-pinned-folders"
import { TrashDialog } from "./trash-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useLocalStorage } from "@/hooks/use-local-storage"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"

interface FileSidebarProps {
  currentPath: string
}

function DriveNavIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
    </svg>
  )
}

function SortableNavItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group/drag relative"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        tabIndex={-1}
        className="absolute left-0.5 top-1/2 z-10 -translate-y-1/2 cursor-grab touch-none rounded p-0.5 opacity-0 active:cursor-grabbing group-hover/drag:opacity-100"
      >
        <GripVerticalIcon className="size-3 text-muted-foreground/40" />
      </button>
      {children}
    </div>
  )
}

const DEFAULT_SIDEBAR_ORDER = ["all", "disk", "drive"]

function FileSidebar({ currentPath: _currentPath }: FileSidebarProps) {
  const pathname = usePathname()
  const { pinned, unpin } = usePinnedFolders()
  const [trashOpen, setTrashOpen] = React.useState(false)
  const [driveConnected, setDriveConnected] = React.useState(false)
  const [order, setOrder] = useLocalStorage<string[]>("wms:files:sidebar-order", DEFAULT_SIDEBAR_ORDER)

  React.useEffect(() => {
    import("@/lib/actions/drive").then(({ getDriveConnectionStatus }) => {
      getDriveConnectionStatus().then((s) => setDriveConnected(s.connected))
    })
  }, [])

  const driveActive = !!pathname && pathname.startsWith("/files/drive")
  const diskSubActive = !!pathname && pathname.startsWith("/files/") && !driveActive

  // Build merged ordered ID list
  const pinnedIds = pinned.map((f) => `p:${f.path}`)
  const allIds = ["all", "disk", "drive", ...pinnedIds]
  const orderedIds = [
    ...order.filter((id) => allIds.includes(id)),
    ...allIds.filter((id) => !order.includes(id)),
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = orderedIds.indexOf(active.id as string)
      const newIndex = orderedIds.indexOf(over.id as string)
      setOrder(arrayMove(orderedIds, oldIndex, newIndex))
    }
  }

  function renderNavItem(id: string) {
    if (id === "all") {
      const active = pathname === "/files"
      return (
        <SortableNavItem key="all" id="all">
          <Link
            href="/files"
            className={cn(
              "group flex items-center gap-2.5 rounded-lg pl-6 pr-3 py-2 text-sm font-medium transition-all",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FolderIcon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            Tüm Dosyalar
          </Link>
        </SortableNavItem>
      )
    }
    if (id === "disk") {
      const diskActive = !!pathname && (pathname === "/files" || pathname.startsWith("/files/")) && !driveActive && new URLSearchParams(typeof window !== "undefined" ? window.location.search : "").get("source") === "disk"
      return (
        <SortableNavItem key="disk" id="disk">
          <Link
            href="/files?source=disk"
            className={cn(
              "group flex items-center gap-2.5 rounded-lg pl-6 pr-3 py-2 text-sm font-medium transition-all",
              diskSubActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <HardDriveIcon className={cn("size-4 shrink-0", diskSubActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            Sunucu
          </Link>
        </SortableNavItem>
      )
    }
    if (id === "drive") {
      if (driveConnected) {
        return (
          <SortableNavItem key="drive" id="drive">
            <Link
              href="/files/drive"
              className={cn(
                "group flex items-center gap-2.5 rounded-lg pl-6 pr-3 py-2 text-sm font-medium transition-all",
                driveActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <DriveNavIcon className={cn("size-4 shrink-0", driveActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              Google Drive
            </Link>
          </SortableNavItem>
        )
      }
      return (
        <SortableNavItem key="drive" id="drive">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="flex cursor-not-allowed items-center gap-2.5 rounded-lg pl-6 pr-3 py-2 text-sm font-medium text-muted-foreground/40 select-none">
                  <DriveNavIcon className="size-4 shrink-0" />
                  Google Drive
                </span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">
                Admin tarafından bağlanmadı
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </SortableNavItem>
      )
    }
    if (id.startsWith("p:")) {
      const folderPath = id.slice(2)
      const folder = pinned.find((f) => f.path === folderPath)
      if (!folder) return null
      const active = !!pathname && (pathname === `/files/${folderPath}` || pathname.startsWith(`/files/${folderPath}/`))
      return (
        <SortableNavItem key={id} id={id}>
          <Link
            href={`/files/${folderPath}`}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg pl-6 pr-8 py-2 text-sm font-medium transition-all",
              active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <FolderIcon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
            <span className="truncate">{folder.name}</span>
          </Link>
          <button
            type="button"
            onClick={() => unpin(folderPath)}
            title="Sabitlenenlerden kaldır"
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden rounded p-0.5 text-muted-foreground hover:text-foreground group-hover/drag:block"
          >
            <PinOffIcon className="size-3.5" />
          </button>
        </SortableNavItem>
      )
    }
    return null
  }

  return (
    <>
      <div className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/5">
        <div className="space-y-4 p-4">
          <div className="px-2 text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
            Sabitlenenler
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <nav className="space-y-1">
                {orderedIds.map((id) => renderNavItem(id))}
              </nav>
            </SortableContext>
          </DndContext>
        </div>

        <div className="mt-auto border-t border-border p-4">
          <button
            type="button"
            onClick={() => setTrashOpen(true)}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
          >
            <Trash2Icon className="size-4 shrink-0" />
            Çöp Kutusu
          </button>
        </div>
      </div>

      <TrashDialog open={trashOpen} onOpenChange={setTrashOpen} />
    </>
  )
}

const FILE_TYPE_GROUPS: Record<string, { label: string; exts: string[] }> = {
  documents: { label: "Belgeler", exts: ["pdf", "doc", "docx", "odt", "txt", "md", "rtf"] },
  spreadsheets: { label: "Elektronik Tablolar", exts: ["xls", "xlsx", "csv", "ods"] },
  images: { label: "Görseller", exts: ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "bmp"] },
  code: { label: "Kod", exts: ["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "sh", "yaml"] },
  archives: { label: "Arşivler", exts: ["zip", "rar", "tar", "gz", "7z"] },
  media: { label: "Medya", exts: ["mp4", "mov", "mp3", "wav", "avi", "mkv"] },
}

function getFileTypes(groups: Set<string>): string[] {
  if (groups.size === 0) return []
  const exts: string[] = []
  for (const g of groups) {
    if (FILE_TYPE_GROUPS[g]) exts.push(...FILE_TYPE_GROUPS[g].exts)
  }
  return exts
}

interface FileLayoutProps {
  children: React.ReactNode
  currentPath: string
  onViewModeChange?: (mode: "grid" | "list") => void
  viewMode?: "grid" | "list"
  onTogglePreview?: () => void
  showPreview?: boolean
  onSearch: (opts: SearchOptions) => void
  onQueryChange: (query: string) => void
  onClearSearch: () => void
  isSearching: boolean
  hasSearchResults: boolean
}

export function FileLayout({
  children,
  currentPath,
  onViewModeChange,
  viewMode = "list",
  onTogglePreview,
  showPreview,
  onSearch,
  onQueryChange,
  onClearSearch,
  isSearching,
  hasSearchResults,
}: FileLayoutProps) {
  const router = useRouter()
  const [query, setQuery] = React.useState("")
  const [scope, setScope] = React.useState<"all" | "current">("all")
  const [selectedGroups, setSelectedGroups] = React.useState<Set<string>>(new Set())
  const [includeContent, setIncludeContent] = React.useState(false)
  const [filterOpen, setFilterOpen] = React.useState(false)

  const hasFilters = selectedGroups.size > 0 || scope === "current" || includeContent
  const filterCount = (scope === "current" ? 1 : 0) + selectedGroups.size + (includeContent ? 1 : 0)

  const buildOpts = React.useCallback(
    (overrides?: { scope?: "all" | "current"; groups?: Set<string> }): SearchOptions => ({
      query,
      scope: (overrides?.scope ?? scope) === "current" ? currentPath : "",
      fileTypes: getFileTypes(overrides?.groups ?? selectedGroups),
      includeContent,
    }),
    [query, scope, currentPath, selectedGroups, includeContent]
  )

  const handleQueryChange = (q: string) => {
    setQuery(q)
    onQueryChange(q)
    if (!q.trim()) onClearSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && query.trim()) {
      onSearch(buildOpts())
    }
    if (e.key === "Escape") {
      setQuery("")
      onClearSearch()
    }
  }

  const handleClear = () => {
    setQuery("")
    onClearSearch()
  }

  const toggleGroup = (group: string) => {
    const next = new Set(selectedGroups)
    if (next.has(group)) next.delete(group)
    else next.add(group)
    setSelectedGroups(next)
    if (query.trim() && hasSearchResults) {
      onSearch({
        query,
        scope: scope === "current" ? currentPath : "",
        fileTypes: getFileTypes(next),
        includeContent,
      })
    }
  }

  const toggleScope = (newScope: "all" | "current") => {
    setScope(newScope)
    if (query.trim() && hasSearchResults) {
      onSearch({
        query,
        scope: newScope === "current" ? currentPath : "",
        fileTypes: getFileTypes(selectedGroups),
        includeContent,
      })
    }
  }

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <FileSidebar currentPath={currentPath} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/50 px-6 backdrop-blur-md">
          <div className="flex flex-1 items-center gap-2">
            {/* Back / Forward */}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => router.back()}
              >
                <ArrowLeftIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7 text-muted-foreground hover:text-foreground"
                onClick={() => router.forward()}
              >
                <ArrowRightIcon className="size-3.5" />
              </Button>
            </div>

            {/* Search input */}
            <div className="relative w-72">
              <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Dosya ara… (Aramak için Enter)"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                className="h-8 border-none bg-muted/40 pr-8 pl-8 text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
              />
              {(query || hasSearchResults) && (
                <button
                  type="button"
                  className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                  onClick={handleClear}
                >
                  <XIcon className="size-3" />
                </button>
              )}
            </div>

            {/* Filter popover */}
            <Popover open={filterOpen} onOpenChange={setFilterOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant={hasFilters ? "default" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    hasFilters
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <SlidersHorizontalIcon className="size-3.5" />
                  Filtreler
                  {filterCount > 0 && (
                    <span className="flex size-4 items-center justify-center rounded-full bg-primary-foreground/20 text-[10px] font-bold">
                      {filterCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-4">
                <div className="space-y-4">
                  {/* Scope */}
                  <div>
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      Arama kapsamı
                    </p>
                    <div className="space-y-1.5">
                      {(["all", "current"] as const).map((s) => (
                        <label
                          key={s}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={scope === s}
                            onCheckedChange={() => toggleScope(s)}
                            className="size-3.5"
                          />
                          {s === "all" ? "Tüm dosyalar" : `Mevcut klasör${currentPath ? ` (${currentPath.split("/").pop()})` : ""}`}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* File types */}
                  <div>
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      Dosya türleri
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      {Object.entries(FILE_TYPE_GROUPS).map(([key, { label }]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-muted/50"
                        >
                          <Checkbox
                            checked={selectedGroups.has(key)}
                            onCheckedChange={() => toggleGroup(key)}
                            className="size-3.5"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Content search */}
                  <div>
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      İçerik araması
                    </p>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">Dosyaların içinde ara</p>
                        <p className="text-[10px] text-muted-foreground">PDF, Word, Excel (yavaş)</p>
                      </div>
                      <Switch
                        checked={includeContent}
                        onCheckedChange={setIncludeContent}
                        className="scale-90"
                      />
                    </div>
                    {includeContent && (
                      <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                        İçerik araması başlatmak için Enter'a basın
                      </p>
                    )}
                  </div>

                  {/* Reset */}
                  {hasFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-full text-xs text-muted-foreground"
                      onClick={() => {
                        setScope("all")
                        setSelectedGroups(new Set())
                        setIncludeContent(false)
                        if (query.trim() && hasSearchResults) {
                          onSearch({ query, scope: "", fileTypes: [], includeContent: false })
                        }
                      }}
                    >
                      Filtreleri sıfırla
                    </Button>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* Searching indicator */}
            {isSearching && (
              <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
            )}
          </div>

          <div className="flex items-center gap-1">
            <div className="mr-2 flex items-center rounded-lg bg-muted/40 p-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-7", viewMode === "list" && "bg-background shadow-sm")}
                onClick={() => onViewModeChange?.("list")}
              >
                <ListIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("size-7", viewMode === "grid" && "bg-background shadow-sm")}
                onClick={() => onViewModeChange?.("grid")}
              >
                <LayoutGridIcon className="size-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              className={cn("size-8", showPreview && "border-primary/20 bg-primary/5 text-primary")}
              onClick={onTogglePreview}
            >
              <PanelRightIcon className="size-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}