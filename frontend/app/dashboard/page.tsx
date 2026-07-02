"use client"

import React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TaskOverviewChart } from "@/components/dashboard/task-overview-chart"
import { TeamWorkloadChart } from "@/components/dashboard/team-workload-chart"
import { useAuth } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"

export default function DashboardPage() {
  const { user } = useAuth()
  const firstName = user?.name?.split(" ")[0] ?? "there"
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
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Günaydın, {firstName} 👋</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Bugün ekibinizde neler oluyor.
              </p>
            </div>
            <StatsCards />
            {canViewAnalytics && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <TaskOverviewChart />
                <TeamWorkloadChart />
              </div>
            )}
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