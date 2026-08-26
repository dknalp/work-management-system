"use client"

/**
 * Analytics page — KPI stats, charts, deadline tracker, upcoming tasks,
 * and recent activity.
 *
 * All dynamic content is wrapped in <ClientOnly> so server HTML and first
 * client paint are identical (AnalyticsPageSkeleton), eliminating React
 * error #418.
 */

import React from "react"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { ClientOnly } from "@/components/ui/client-only"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { TaskOverviewChart } from "@/components/dashboard/task-overview-chart"
import { TeamWorkloadChart } from "@/components/dashboard/team-workload-chart"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { UpcomingTasks } from "@/components/dashboard/upcoming-tasks"
import { DeadlineTracker } from "@/components/dashboard/deadline-tracker"
import { usePermission } from "@/hooks/use-permission"
import { BarChart3 } from "lucide-react"

/**
 * Stable skeleton shown during SSR and the first client paint.
 * No context, no auth, no dynamic data — identical on server and client.
 */
function AnalyticsPageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-8 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="size-9 rounded-xl bg-muted" />
        <div className="space-y-1.5">
          <div className="h-5 w-24 rounded bg-muted" />
          <div className="h-3.5 w-48 rounded bg-muted" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-muted h-28" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-muted h-64" />
        <div className="rounded-2xl bg-muted h-64" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-muted h-48" />
        <div className="rounded-2xl bg-muted h-48" />
      </div>
    </div>
  )
}

/**
 * Inner component rendered only after hydration (inside ClientOnly).
 * Safe to use hooks that read from context or permissions.
 */
function AnalyticsContent() {
  const canViewAnalytics = usePermission("analytics:view")

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-8">
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

      <StatsCards />

      <DeadlineTracker />

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
  )
}

export default function AnalyticsPage() {
  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <ClientOnly fallback={<AnalyticsPageSkeleton />}>
            <AnalyticsContent />
          </ClientOnly>
        </main>
      </AppShellDynamic>
  )
}