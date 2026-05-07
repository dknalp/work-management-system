"use client"

import * as React from "react"
import { FileItem } from "@/lib/actions/files"
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
  const [viewMode, setViewMode] = React.useState<"grid" | "list">("list")
  const [showPreview, setShowPreview] = React.useState(true)

  return (
    <FileLayout
      currentPath={currentPath}
      viewMode={viewMode}
      onViewModeChange={setViewMode}
      showPreview={showPreview}
      onTogglePreview={() => setShowPreview(!showPreview)}
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
          />
        </div>
      </FileDropZone>
    </FileLayout>
  )
}
