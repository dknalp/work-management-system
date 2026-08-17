"use client"

import * as React from "react"
import type { FileItem } from "@/components/files/file-utils"
import { fileRecordToItem } from "@/components/files/file-utils"
import { FileExplorer } from "@/components/files/file-explorer"
import { listFiles, searchFiles } from "@/lib/actions/files"

interface FileClientPageProps {
  initialItems: FileItem[]
  currentPath: string
  isDrivePath?: boolean
}

export function FileClientPage({ initialItems, currentPath }: FileClientPageProps) {
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const [showPreview, setShowPreview] = React.useState(false)
  const [items, setItems] = React.useState<FileItem[]>(initialItems)
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<FileItem[] | null>(null)
  const [isSearching, setIsSearching] = React.useState(false)

  const load = React.useCallback(async () => {
    try {
      const records = await listFiles(currentPath)
      setItems(records.map(fileRecordToItem))
    } catch {
      setItems([])
    }
  }, [currentPath])

  React.useEffect(() => {
    load()
  }, [load])

  // Re-fetch after uploads/deletes
  React.useEffect(() => {
    const handler = () => load()
    window.addEventListener("wms:files:changed", handler)
    return () => window.removeEventListener("wms:files:changed", handler)
  }, [load])

  const handleSearch = React.useCallback(async (query: string) => {
    setSearchQuery(query)
    if (!query.trim()) {
      setSearchResults(null)
      return
    }
    setIsSearching(true)
    try {
      const records = await searchFiles(query, currentPath)
      setSearchResults(records.map(fileRecordToItem))
    } catch {
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [currentPath])

  return (
    <FileExplorer
      items={items}
      currentPath={currentPath}
      viewMode={viewMode}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview((v) => !v)}
      searchQuery={searchQuery}
      searchResults={searchResults}
      isSearching={isSearching}
      onClearSearch={() => {
        setSearchQuery("")
        setSearchResults(null)
      }}
    />
  )
}

// Export setters so FileLayout toolbar can trigger search
export type { FileClientPageProps }