"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FolderIcon,
  ImageIcon,
  FileTextIcon,
  ClockIcon,
  StarIcon,
  LayoutGridIcon,
  ListIcon,
  PanelRightIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchOptions } from "@/lib/actions/files"

interface FileSidebarProps {
  currentPath: string
}

function FileSidebar({ currentPath: _currentPath }: FileSidebarProps) {
  const pathname = usePathname()

  const links = [
    { label: "All Files", path: "/files", icon: FolderIcon },
    { label: "Documents", path: "/files/Documents", icon: FileTextIcon },
    { label: "Images", path: "/files/Images", icon: ImageIcon },
    { label: "Recent", path: "/files?sort=recent", icon: ClockIcon },
    { label: "Starred", path: "/files?filter=starred", icon: StarIcon },
  ]

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/5">
      <div className="space-y-4 p-4">
        <div className="px-2 text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
          Favorites
        </div>
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.path
            return (
              <Link
                key={link.label}
                href={link.path}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

const FILE_TYPE_GROUPS: Record<string, { label: string; exts: string[] }> = {
  documents: { label: "Documents", exts: ["pdf", "doc", "docx", "odt", "txt", "md", "rtf"] },
  spreadsheets: { label: "Spreadsheets", exts: ["xls", "xlsx", "csv", "ods"] },
  images: { label: "Images", exts: ["jpg", "jpeg", "png", "gif", "webp", "svg", "heic", "bmp"] },
  code: { label: "Code", exts: ["js", "ts", "jsx", "tsx", "py", "html", "css", "json", "sh", "yaml"] },
  archives: { label: "Archives", exts: ["zip", "rar", "tar", "gz", "7z"] },
  media: { label: "Media", exts: ["mp4", "mov", "mp3", "wav", "avi", "mkv"] },
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
            {/* Search input */}
            <div className="relative w-72">
              <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files… (Enter to search)"
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
                  Filters
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
                      Search scope
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
                          {s === "all" ? "All files" : `Current folder${currentPath ? ` (${currentPath.split("/").pop()})` : ""}`}
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* File types */}
                  <div>
                    <p className="mb-2 text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
                      File types
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
                      Content search
                    </p>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                      <div>
                        <p className="text-xs font-medium">Search inside files</p>
                        <p className="text-[10px] text-muted-foreground">PDF, Word, Excel (slower)</p>
                      </div>
                      <Switch
                        checked={includeContent}
                        onCheckedChange={setIncludeContent}
                        className="scale-90"
                      />
                    </div>
                    {includeContent && (
                      <p className="mt-1.5 text-[10px] text-amber-600 dark:text-amber-400">
                        Press Enter to start content search
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
                      Reset filters
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