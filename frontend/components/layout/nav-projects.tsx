"use client"

import Link from "next/link"
import { Files, FolderIcon, MoreHorizontal, PinOff } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { usePinnedFolders } from "@/hooks/use-pinned-folders"

export function NavProjects() {
  const { isMobile } = useSidebar()
  const { pinned, unpin } = usePinnedFolders()

  return (
    <SidebarGroup className="group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel>Sabitlenenler</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href="/files">
              <Files />
              <span>Tüm Dosyalar</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>

        {pinned.map((folder) => (
          <SidebarMenuItem key={folder.path}>
            <SidebarMenuButton asChild>
              <Link href={`/files/${folder.path}`}>
                <FolderIcon />
                <span>{folder.name}</span>
              </Link>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover>
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem onClick={() => unpin(folder.path)}>
                  <PinOff className="text-muted-foreground" />
                  <span>Sabitlenenlerden kaldır</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
