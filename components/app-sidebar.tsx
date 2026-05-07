"use client"

import * as React from "react"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
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
} from "lucide-react"

import { usePathname } from "next/navigation"

const data = {
  user: {
    name: "Alex Johnson",
    email: "alex@workos.com",
    avatar: "/avatars/alex.jpg",
  },
  navMain: [
    {
      title: "Analytics",
      url: "/dashboard",
      icon: <LayoutDashboardIcon />,
    },
    {
      title: "Pipeline board view",
      url: "/dashboard/board",
      icon: <KanbanIcon />,
    },
    {
      title: "Tasks",
      url: "/tasks",
      icon: <CheckSquareIcon />,
    },
    {
      title: "Calendar",
      url: "/calendar",
      icon: <CalendarIcon />,
    },
    {
      title: "Files",
      url: "/files",
      icon: <FolderIcon />,
    },
    {
      title: "Team",
      url: "/team",
      icon: <UsersIcon />,
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/settings",
      icon: <Settings2Icon />,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()

  const navMainWithActive = data.navMain.map((item) => ({
    ...item,
    isActive:
      pathname === item.url ||
      (item.url !== "/dashboard" && pathname.startsWith(item.url)),
  }))

  const navSecondaryWithActive = data.navSecondary.map((item) => ({
    ...item,
    isActive: pathname === item.url,
  }))

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
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
