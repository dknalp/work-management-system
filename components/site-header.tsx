"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { BellIcon, PlusIcon, SearchIcon } from "lucide-react"

export function SiteHeader() {
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
            Dashboard
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
            >
              <BellIcon className="size-4" />
            </Button>
            {/* Unread indicator dot */}
            <span className="pointer-events-none absolute top-2 right-2 flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
              <span className="relative inline-flex size-2 rounded-full bg-destructive" />
            </span>
          </div>

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
