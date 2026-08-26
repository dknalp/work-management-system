"use client"

/**
 * Home page — main dashboard after login.
 *
 * Dynamic dashboard widgets are wrapped in <ClientOnly> so that the static
 * server skeleton (HomePageSkeleton) is identical on server and first client
 * paint.  Real content renders after hydration, eliminating React error #418.
 */

import React from "react"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { ClientOnly } from "@/components/ui/client-only"
import { HomeHero } from "@/components/dashboard/home-hero"
import { TodaysTasks } from "@/components/dashboard/todays-tasks"
import { RemindersWidget } from "@/components/dashboard/reminders-widget"
import { DeadlineTracker } from "@/components/dashboard/deadline-tracker"
import { ProjectsGrid } from "@/components/dashboard/projects-grid"

/**
 * Stable skeleton shown during SSR and the first client paint.
 * Must produce identical HTML on server and client — no context, no auth,
 * no dynamic data.
 */
function HomePageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-8 animate-pulse">
      <div className="rounded-2xl bg-muted h-32 w-full" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-muted h-48 w-full" />
        <div className="rounded-2xl bg-muted h-48 w-full" />
      </div>
      <div className="rounded-2xl bg-muted h-40 w-full" />
      <div className="rounded-2xl bg-muted h-48 w-full" />
    </div>
  )
}

export default function HomePage() {
  return (
    <AppShellDynamic>
      <main className="flex flex-1 flex-col overflow-auto bg-background">
        <ClientOnly fallback={<HomePageSkeleton />}>
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-8">
            <HomeHero />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TodaysTasks />
              <RemindersWidget />
            </div>

            <DeadlineTracker />

            <ProjectsGrid />
          </div>
        </ClientOnly>
      </main>
    </AppShellDynamic>
  )
}