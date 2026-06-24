import React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { CalendarGrid } from "@/components/calendar/calendar-grid"
import { Toaster } from "@/components/ui/sonner"
import { cn } from "@/lib/utils"

export default function CalendarPage() {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          <div className="flex min-h-0 flex-1 gap-5 overflow-hidden p-5">
            {/* Left sidebar — filters & mini-info */}
            <aside className="hidden w-56 shrink-0 flex-col gap-5 overflow-y-auto lg:flex">
              {/* My Calendars */}
              <div className="space-y-2.5">
                <h3 className="px-0.5 text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
                  My Calendars
                </h3>
                <div className="space-y-1.5">
                  {[
                    { label: "Team Events", color: "bg-blue-500" },
                    { label: "Personal Tasks", color: "bg-orange-500" },
                    { label: "Deadlines", color: "bg-rose-500" },
                    { label: "Research", color: "bg-violet-500" },
                    { label: "Partners", color: "bg-emerald-500" },
                  ].map(({ label, color }) => (
                    <div
                      key={label}
                      className="group flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 transition-colors hover:bg-muted/50"
                    >
                      <div className={cn("size-2.5 rounded-sm", color)} />
                      <span className="text-sm font-medium text-foreground/80 transition-colors group-hover:text-foreground">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-auto text-xs text-muted-foreground">
                Bir güne tıklayarak etkinliklerini görün. <span className="font-medium">+</span> ikonuyla hızlıca etkinlik ekleyin.
              </p>
            </aside>

            {/* Main calendar area */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <CalendarGrid />
            </div>
          </div>
        </main>
      </SidebarInset>

      {/* Toast notifications */}
      <Toaster position="bottom-right" richColors />
    </SidebarProvider>
  )
}
