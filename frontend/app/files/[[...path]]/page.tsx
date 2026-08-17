import React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { FileClientPage } from "@/components/files/file-client-page"

interface PageProps {
  params: Promise<{
    path?: string[]
  }>
}

export default async function FilesPage({ params }: PageProps) {
  const resolvedParams = await params
  const pathSegments = resolvedParams.path ?? []
  const currentPath = pathSegments.join("/")

  // Files are fetched client-side (auth tokens live in localStorage).
  // FileClientPage loads items via useEffect → listFiles(currentPath).

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col">
          <FileClientPage
            initialItems={[]}
            currentPath={currentPath}
            isDrivePath={false}
          />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}