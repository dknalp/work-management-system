"use client"

import * as React from "react"
import { NavMain } from "@/components/layout/nav-main"
import { NavSecondary } from "@/components/layout/nav-secondary"
import { NavUser } from "@/components/layout/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
  BriefcaseIcon,
  LayoutDashboardIcon,
  KanbanIcon,
  CheckSquareIcon,
  CalendarIcon,
  FolderIcon,
  UsersIcon,
  Settings2Icon,
  ShieldIcon,
} from "lucide-react"

import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"

const navMain = [
    {
    title: "Analitik",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
  },
  {
    title: "Pipeline Panosu",
    url: "/dashboard/board",
    icon: <KanbanIcon />,
  },
  {
    title: "Görevler",
    url: "/tasks",
    icon: <CheckSquareIcon />,
  },
  {
    title: "Takvim",
    url: "/calendar",
    icon: <CalendarIcon />,
  },
  {
    title: "Dosyalar",
    url: "/files",
    icon: <FolderIcon />,
  },
  {
    title: "Ekip",
    url: "/team",
    icon: <UsersIcon />,
  },
]

const navSecondary = [
  {
    title: "Ayarlar",
    url: "/settings",
    icon: <Settings2Icon />,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { user } = useAuth()

  const navMainWithActive = navMain.map((item) => ({
    ...item,
    isActive:
      pathname === item.url ||
      (item.url !== "/dashboard" && pathname.startsWith(item.url)),
  }))

  const adminItem = user?.is_admin
    ? [{ title: "Yönetici", url: "/admin", icon: <ShieldIcon />, isActive: pathname === "/admin" || pathname.startsWith("/admin/") }]
    : []

  const navSecondaryWithActive = [
    ...adminItem,
    ...navSecondary.map((item) => ({
      ...item,
      isActive: pathname === item.url,
    })),
  ]

  const sidebarUser = {
    name: user?.name ?? "...",
    email: user?.email ?? "",
    avatar: user?.avatar_url ?? "",
  }

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader className="border-b border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-2!"
            >
              <a href="/dashboard" className="flex items-center gap-2.5">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-primary-foreground! shadow-sm">
                  <BriefcaseIcon className="size-4!" />
                </div>
                <span className="text-base font-semibold tracking-tight">
                  WorkOS
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMainWithActive} />
        <NavSecondary items={navSecondaryWithActive} className="mt-auto" />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  )
}
