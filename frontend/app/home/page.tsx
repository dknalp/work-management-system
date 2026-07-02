"use client"

import React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { HomeHero } from "@/components/dashboard/home-hero"
import { TodaysTasks } from "@/components/dashboard/todays-tasks"
import { RemindersWidget } from "@/components/dashboard/reminders-widget"
import { DeadlineTracker } from "@/components/dashboard/deadline-tracker"
import { ProjectsGrid } from "@/components/dashboard/projects-grid"

export default function HomePage() {
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
            <HomeHero />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <TodaysTasks />
              <RemindersWidget />
            </div>

            <DeadlineTracker />

            <ProjectsGrid />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}