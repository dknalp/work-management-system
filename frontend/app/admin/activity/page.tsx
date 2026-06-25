"use client"

import React from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { useAuth } from "@/contexts/auth-context"
import { useTasks } from "@/contexts/task-context"
import { ActivityIcon, ArrowLeftIcon } from "lucide-react"
import { redirect } from "next/navigation"

export default function ActivityLogPage() {
  const { user, loading } = useAuth()
  const { activity } = useTasks()

  if (loading) return null
  if (!user?.is_admin) redirect("/dashboard")

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeftIcon className="size-3.5" />
              Admin Panel
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ActivityIcon className="size-4" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
              <p className="text-sm text-muted-foreground">
                {activity.length} event{activity.length !== 1 ? "s" : ""} recorded.
              </p>
            </div>
          </div>

          {/* Full activity list */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="divide-y divide-border/40">
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                activity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {entry.taskTitle}{entry.detail ? ` — ${entry.detail}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}