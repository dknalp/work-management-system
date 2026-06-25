"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { PlusIcon, SearchIcon } from "lucide-react"
import { NotificationsPopover } from "@/components/notifications-popover"
import { CreateTaskDialog } from "@/components/create-task-dialog"

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/dashboard/board": "Pipeline Board",
  "/tasks": "Tasks",
  "/calendar": "Calendar",
  "/files": "Files",
  "/team": "Team",
  "/settings": "Settings",
  "/profile": "Profile",
  "/admin": "Admin Panel",
  "/admin/activity": "Activity Log",
}

function getRouteLabel(pathname: string): string {
  if (routeLabels[pathname]) return routeLabels[pathname]
  if (pathname.startsWith("/files/")) return "Files"
  return "Dashboard"
}

export function SiteHeader() {
  const pathname = usePathname()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border bg-background/95 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        {/* Left: Sidebar trigger + breadcrumb */}
        <div className="flex shrink-0 items-center gap-2">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:mx-1 data-[orientation=vertical]:h-4"
          />
          <span className="hidden text-sm font-medium text-foreground sm:block">
            {getRouteLabel(pathname)}
          </span>
        </div>

        {/* Center: Search bar */}
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="relative w-full max-w-md">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 w-full cursor-pointer rounded-lg border-border bg-muted/50 pr-16 pl-9 text-sm placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1"
              placeholder="Search anything..."
              aria-label="Global search"
              readOnly
              onClick={() => {
                document.dispatchEvent(
                  new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
                )
              }}
            />
            <div className="pointer-events-none absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
              <kbd className="inline-flex h-5 items-center gap-0.5 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground select-none">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Notifications + Create */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Notification bell */}
          <NotificationsPopover />

          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:mx-0.5 data-[orientation=vertical]:h-4"
          />

          {/* Create New button */}
          <Button size="sm" className="gap-2 font-medium" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-4" />
            <span className="hidden sm:inline">Create New</span>
          </Button>
        </div>
      </div>
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  )
}