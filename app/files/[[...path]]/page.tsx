import React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { listFiles } from "@/lib/actions/files"
import { FileClientPage } from "@/components/files/file-client-page"

interface PageProps {
  params: Promise<{
    path?: string[]
  }>
}

export default async function FilesPage({ params }: PageProps) {
  const resolvedParams = await params
  const currentPath = resolvedParams.path ? resolvedParams.path.join("/") : ""
  const items = await listFiles(currentPath)

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
          <FileClientPage items={items} currentPath={currentPath} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
