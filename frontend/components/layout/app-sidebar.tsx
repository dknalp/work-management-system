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
  HomeIcon,
  BarChart3Icon,
  KanbanIcon,
  CheckSquareIcon,
  CalendarIcon,
  FolderIcon,
  UsersIcon,
  Settings2Icon,
  ShieldIcon,
  KeyRoundIcon,
  ExternalLinkIcon,
  BotIcon,
  BookOpenIcon,
  ReceiptIcon,
} from "lucide-react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import { getLinksForRole, type CustomNavLink } from "@/lib/custom-nav"
import { SidebarProjects } from "@/components/layout/sidebar-projects"

const navMain = [
  {
    title: "Ana Sayfa",
    url: "/home",
    icon: <HomeIcon />,
  },
  {
    title: "Analitik",
    url: "/analytics",
    icon: <BarChart3Icon />,
  },
  {
    title: "Pipeline'lar",
    url: "/pipelines",
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
  {
    title: "Gider Yönetimi",
    url: "/expenses",
    icon: <ReceiptIcon />,
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
  const [customLinks, setCustomLinks] = React.useState<CustomNavLink[]>([])
  const canViewTasks = usePermission("tasks:view")
  const canViewBoard = usePermission("board:view")
  const canViewCalendar = usePermission("calendar:view")
  const canViewFiles = usePermission("files:view")
  const canViewTeam = usePermission("team:view")
  const canViewAdmin = usePermission("admin:view")

  React.useEffect(() => {
    const load = () => {
      setCustomLinks(getLinksForRole(user?.role ?? "member", user?.is_admin ?? false))
    }
    load()
    window.addEventListener("wms:custom-nav-changed", load)
    return () => window.removeEventListener("wms:custom-nav-changed", load)
  }, [user])

  const [botsTabActive, setBotsTabActive] = React.useState(false)
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBotsTabActive(params.get("tab") === "bots")
  }, [pathname])

  const navMainWithActive = navMain
    .filter((item) => {
      if (item.url === "/tasks") return canViewTasks
      if (item.url === "/pipelines") return canViewBoard
      if (item.url === "/calendar") return canViewCalendar
      if (item.url === "/files") return canViewFiles
      if (item.url === "/team") return canViewTeam
      if (item.url === "/expenses")
        return (
          user?.is_admin ||
          user?.role === "admin" ||
          user?.role === "manager"
        ) ?? false
      return true
    })
    .map((item) => ({
      ...item,
      isActive: item.url.startsWith("/files?view=")
        ? typeof window !== "undefined" && window.location.pathname + window.location.search === item.url
        : pathname === item.url,
    }))

  const navSecondaryWithActive = navSecondary.map((item) => ({
    ...item,
    isActive: pathname === item.url,
  }))

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
              <a href="/home" className="flex items-center gap-2.5">
                <img src="/kiwimi-office-black-logo.png" alt="Kiwimi - Workin" className="size-7 rounded-lg object-contain" />
                <span className="text-base font-semibold tracking-tight">
                  Kiwimi - Workin
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <NavMain items={navMainWithActive} />
        <SidebarProjects />
        {customLinks.length > 0 && (
          <SidebarMenu className="px-2">
            {customLinks.map((link) => (
              <SidebarMenuItem key={link.id}>
                <SidebarMenuButton asChild size="sm">
                  <a href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between">
                    <span>{link.title}</span>
                    <ExternalLinkIcon className="size-3 shrink-0 text-muted-foreground" />
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        )}
        <div className="mt-auto">
          {canViewAdmin && (
            <SidebarMenu className="px-2 pb-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/admin"} size="sm">
                  <Link href="/admin">
                    <ShieldIcon />
                    <span>Yönetici</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="pl-4">
                <SidebarMenuButton asChild isActive={pathname === "/admin/roles"} size="sm">
                  <Link href="/admin/roles">
                    <KeyRoundIcon />
                    <span>Rol İzinleri</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem className="pl-4">
                <SidebarMenuButton asChild isActive={pathname.startsWith("/admin") && botsTabActive} size="sm">
                  <Link href="/admin?tab=bots">
                    <BotIcon />
                    <span>Bot Hesapları</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
          <SidebarMenu className="px-2 pb-1">
            <SidebarMenuItem>
              <SidebarMenuButton asChild isActive={pathname === "/docs"} size="sm">
                <Link href="/docs">
                  <BookOpenIcon />
                  <span>API Docs</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <NavSecondary items={navSecondaryWithActive} />
        </div>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <NavUser user={sidebarUser} />
      </SidebarFooter>
    </Sidebar>
  )
}