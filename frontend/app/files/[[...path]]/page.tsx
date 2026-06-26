import React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listFiles } from "@/lib/actions/files"
import { listDriveFiles } from "@/lib/actions/drive"
import { FileClientPage } from "@/components/files/file-client-page"

interface PageProps {
  params: Promise<{
    path?: string[]
  }>
}

export default async function FilesPage({ params }: PageProps) {
  const resolvedParams = await params
  const pathSegments = resolvedParams.path ?? []

  // /files/drive/... → Drive view
  const isDrivePath = pathSegments[0] === "drive"

  let items
  let currentPath: string

  if (isDrivePath) {
    const drivePath = pathSegments.slice(1).join("/")
    currentPath = drivePath
    items = await listDriveFiles(drivePath)
  } else {
    currentPath = pathSegments.join("/")
    items = await listFiles(currentPath)
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset className="flex flex-col overflow-hidden">
        <SiteHeader />
        <main className="flex-1 overflow-hidden">
          <FileClientPage items={items} currentPath={currentPath} isDrivePath={isDrivePath} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}