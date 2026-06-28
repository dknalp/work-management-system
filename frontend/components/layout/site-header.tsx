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
  "/dashboard": "Analitik",
  "/dashboard/board": "Pipeline Panosu",
  "/tasks": "Görevler",
  "/calendar": "Takvim",
  "/files": "Dosyalar",
  "/team": "Ekip",
  "/settings": "Ayarlar",
  "/profile": "Profil",
  "/admin": "Yönetici Paneli",
  "/admin/activity": "Etkinlik Günlüğü",
  "/admin/roles": "Rol İzinleri",
}

function getRouteLabel(pathname: string): string {
  if (routeLabels[pathname]) return routeLabels[pathname]
  if (pathname.startsWith("/files/")) return "Dosyalar"
  return "Analitik"
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

        {/* Center: header orta bosluk kismi*/}
        <div className="flex flex-1 items-center justify-center px-4">

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
            <span className="hidden sm:inline">Yeni Oluştur</span>
          </Button>
        </div>
      </div>
      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </header>
  )
}