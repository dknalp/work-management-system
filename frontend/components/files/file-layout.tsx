"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  FolderIcon,
  ImageIcon,
  FileTextIcon,
  ClockIcon,
  StarIcon,
  LayoutGridIcon,
  ListIcon,
  PanelRightIcon,
  SearchIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface FileSidebarProps {
  currentPath: string
}

function FileSidebar({ currentPath }: FileSidebarProps) {
  const pathname = usePathname()

  const links = [
    { label: "All Files", path: "/files", icon: FolderIcon },
    { label: "Documents", path: "/files/Documents", icon: FileTextIcon },
    { label: "Images", path: "/files/Images", icon: ImageIcon },
    { label: "Recent", path: "#", icon: ClockIcon },
    { label: "Starred", path: "#", icon: StarIcon },
  ]

  return (
    <div className="flex w-56 shrink-0 flex-col border-r border-border bg-muted/5">
      <div className="space-y-4 p-4">
        <div className="px-2 text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
          Favorites
        </div>
        <nav className="space-y-1">
          {links.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.path
            return (
              <Link
                key={link.label}
                href={link.path}
                className={cn(
                  "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

interface FileLayoutProps {
  children: React.ReactNode
  currentPath: string
  onViewModeChange?: (mode: "grid" | "list") => void
  viewMode?: "grid" | "list"
  onTogglePreview?: () => void
  showPreview?: boolean
}

export function FileLayout({
  children,
  currentPath,
  onViewModeChange,
  viewMode = "list",
  onTogglePreview,
  showPreview,
}: FileLayoutProps) {
  return (
    <div className="flex h-full overflow-hidden bg-background">
      <FileSidebar currentPath={currentPath} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Toolbar */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background/50 px-6 backdrop-blur-md">
          <div className="flex flex-1 items-center gap-4">
            <div className="relative w-64">
              <SearchIcon className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                className="h-8 border-none bg-muted/40 pl-8 text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <div className="mr-2 flex items-center rounded-lg bg-muted/40 p-1">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-7",
                  viewMode === "list" && "bg-background shadow-sm"
                )}
                onClick={() => onViewModeChange?.("list")}
              >
                <ListIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "size-7",
                  viewMode === "grid" && "bg-background shadow-sm"
                )}
                onClick={() => onViewModeChange?.("grid")}
              >
                <LayoutGridIcon className="size-3.5" />
              </Button>
            </div>

            <Button
              variant="outline"
              size="icon"
              className={cn(
                "size-8",
                showPreview && "border-primary/20 bg-primary/5 text-primary"
              )}
              onClick={onTogglePreview}
            >
              <PanelRightIcon className="size-4" />
            </Button>
          </div>
        </header>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}
