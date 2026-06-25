"use client"

import * as React from "react"
import { FileItem, SearchOptions, SearchResult, searchFiles } from "@/lib/actions/files"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { FileLayout } from "./file-layout"
import { FileExplorer } from "./file-explorer"
import { FileBreadcrumbs } from "./file-breadcrumbs"
import { FileToolbar } from "./file-toolbar"
import { FileDropZone } from "./file-drop-zone"

interface FileClientPageProps {
  items: FileItem[]
  currentPath: string
}

export function FileClientPage({ items, currentPath }: FileClientPageProps) {
  const [viewMode, setViewMode] = useLocalStorage<"grid" | "list">("wms:files:viewMode", "list")
  const [showPreview, setShowPreview] = React.useState(true)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<SearchResult[] | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)

  const handleQueryChange = (q: string) => {
    setSearchQuery(q)
    if (!q.trim()) setSearchResults(null)
  }

  const doSearch = React.useCallback(async (opts: SearchOptions) => {
    if (!opts.query.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const results = await searchFiles(opts)
      setSearchResults(results)
    } finally {
      setIsSearching(false)
    }
  }, [])

  const clearSearch = React.useCallback(() => {
    setSearchResults(null)
    setSearchQuery("")
  }, [])

  return (
    <FileLayout
      currentPath={currentPath}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview(!showPreview)}
      onSearch={doSearch}
      onQueryChange={handleQueryChange}
      onClearSearch={clearSearch}
      isSearching={isSearching}
      hasSearchResults={searchResults !== null}
    >
      <FileDropZone currentPath={currentPath}>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between bg-muted/10 px-6 py-4">
            <FileBreadcrumbs currentPath={currentPath} />
            <FileToolbar currentPath={currentPath} />
          </div>

          <FileExplorer
            items={items}
            currentPath={currentPath}
            viewMode={viewMode}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            searchQuery={searchQuery}
            searchResults={searchResults}
            isSearching={isSearching}
            onClearSearch={clearSearch}
          />
        </div>
      </FileDropZone>
    </FileLayout>
  )
}