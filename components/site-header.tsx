"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { BellIcon, PlusIcon, SearchIcon } from "lucide-react"
import { NotificationsModal } from "@/components/notifications/notifications-modal"
import { MOCK_NOTIFICATIONS, type Notification } from "@/components/notifications/notification-types"

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
}

function getRouteLabel(pathname: string): string {
  if (routeLabels[pathname]) return routeLabels[pathname]
  if (pathname.startsWith("/files/")) return "Files"
  return "Dashboard"
}

export function SiteHeader() {
  const pathname = usePathname()
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const unreadCount = notifications.filter(n => !n.read).length

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
              className="h-9 w-full rounded-lg border-border bg-muted/50 pr-16 pl-9 text-sm placeholder:text-muted-foreground focus-visible:bg-background focus-visible:ring-1"
              placeholder="Search anything..."
              aria-label="Global search"
              readOnly
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
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-muted-foreground hover:text-foreground"
              aria-label="Notifications"
              onClick={() => setNotificationsOpen(true)}
            >
              <BellIcon className="size-4" />
            </Button>
            {unreadCount > 0 && (
              <span className="pointer-events-none absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-medium">
                {unreadCount}
              </span>
            )}
          </div>

          <NotificationsModal
            open={notificationsOpen}
            onOpenChange={setNotificationsOpen}
            notifications={notifications}
            onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))}
            onMarkAllRead={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
          />

          <Separator
            orientation="vertical"
            className="data-[orientation=vertical]:mx-0.5 data-[orientation=vertical]:h-4"
          />

          {/* Create New button */}
          <Button size="sm" className="gap-2 font-medium">
            <PlusIcon className="size-4" />
            <span className="hidden sm:inline">Create New</span>
          </Button>
        </div>
      </div>
    </header>
  )
}