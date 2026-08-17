"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import type { FileItem } from "@/components/files/file-utils"
import { fileRecordToItem } from "@/components/files/file-utils"
import { FileExplorer } from "@/components/files/file-explorer"
import { listFiles, listStarred, listRecent } from "@/lib/actions/files"

interface FileClientPageProps {
  initialItems: FileItem[]
  currentPath: string
  isDrivePath?: boolean
}

export function FileClientPage({ initialItems, currentPath }: FileClientPageProps) {
  const searchParams = useSearchParams()
  const view = searchParams.get("view") // "starred" | "recent" | null
  const [viewMode] = React.useState<"grid" | "list">("list")
  const [showPreview, setShowPreview] = React.useState(false)
  const [items, setItems] = React.useState<FileItem[]>(initialItems)

  const load = React.useCallback(async () => {
    try {
      if (view === "starred") {
        const records = await listStarred()
        setItems(records.map(fileRecordToItem))
        return
      }
      if (view === "recent") {
        const records = await listRecent()
        setItems(records.map(fileRecordToItem))
        return
      }
      const records = await listFiles(currentPath)
      setItems(records.map(fileRecordToItem))
    } catch {
      setItems([])
    }
  }, [currentPath, view])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Re-fetch after uploads/deletes
  React.useEffect(() => {
    const handler = () => load()
    window.addEventListener("wms:files:changed", handler)
    return () => window.removeEventListener("wms:files:changed", handler)
  }, [load])

  return (
    <FileExplorer
      items={items}
      currentPath={currentPath}
      viewMode={viewMode}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview((v) => !v)}
      searchQuery=""
      searchResults={null}
      isSearching={false}
    />
  )
}

// Export setters so FileLayout toolbar can trigger search
export type { FileClientPageProps }