"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationsPopover } from "@/components/notifications-popover"

const routeLabels: Record<string, string> = {
  "/home": "Ana Sayfa",
  "/analytics": "Analitik",
  "/board": "Kanban Panosu",
  "/tasks": "Görevler",
  "/calendar": "Takvim",
  "/files": "Dosyalar",
  "/team": "Ekip",
  "/expenses": "Gider Yönetimi",
  "/settings": "Ayarlar",
  "/profile": "Profil",
  "/admin": "Yönetici Paneli",
  "/admin/activity": "Etkinlik Günlüğü",
  "/admin/roles": "Rol İzinleri",
}

function getRouteLabel(pathname: string): string {
  if (routeLabels[pathname]) return routeLabels[pathname]
  if (pathname.startsWith("/files/")) return "Dosyalar"
  if (pathname.startsWith("/projects/")) return "Projeler"
  return "Ana Sayfa"
}

export function SiteHeader() {
  const pathname = usePathname()

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

        {/* Center */}
        <div className="flex-1" />

        {/* Right: Notifications */}
        <div className="flex shrink-0 items-center gap-2">
          <NotificationsPopover />
        </div>
      </div>
    </header>
  )
}