"use client"

import React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TaskOverviewChart } from "@/components/dashboard/task-overview-chart"
import { TeamWorkloadChart } from "@/components/dashboard/team-workload-chart"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { DeadlineTracker } from "@/components/dashboard/deadline-tracker"
import { usePermission } from "@/hooks/use-permission"
import { BarChart3 } from "lucide-react"

export default function AnalyticsPage() {
  const canViewAnalytics = usePermission("analytics:view")

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
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-8">
            {/* Page Header */}
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-muted ring-1 ring-foreground/10">
                <BarChart3 className="size-4 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Analitik</h1>
                <p className="text-sm text-muted-foreground">
                  Ekip performansı ve genel iş durumu
                </p>
              </div>
            </div>

            {/* KPI Stats */}
            <StatsCards />

            {/* Deadline Tracker — only renders when there are deadlines */}
            <DeadlineTracker />

            {/* Charts — permission gated */}
            {canViewAnalytics && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <TaskOverviewChart />
                <TeamWorkloadChart />
              </div>
            )}

            {/* Upcoming Tasks + Recent Activity */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <UpcomingTasks />
              <RecentActivity />
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}