"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { useAuth } from "@/contexts/auth-context"
import { useTasks } from "@/contexts/task-context"
import { useTeam } from "@/contexts/team-context"
import { Badge } from "@/components/ui/badge"
import { ShieldIcon, UsersIcon, CheckSquareIcon, ActivityIcon } from "lucide-react"
import { redirect } from "next/navigation"

export default function AdminPage() {
  const { user } = useAuth()
  const { tasks, activity } = useTasks()
  const { members } = useTeam()

  if (user && !user.is_admin) {
    redirect("/dashboard")
  }

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === "todo").length,
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldIcon className="size-4" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Workspace overview and management.</p>
            </div>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5">
              Admin
            </Badge>
          </div>

          {/* Stats grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Tasks", value: tasks.length, icon: CheckSquareIcon, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
              { label: "Team Members", value: members.length, icon: UsersIcon, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40" },
              { label: "In Progress", value: tasksByStatus["in-progress"], icon: ActivityIcon, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40" },
              { label: "Completed", value: tasksByStatus.done, icon: CheckSquareIcon, color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-muted-foreground">{label}</p>
                  <div className={`flex size-8 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="size-4" />
                  </div>
                </div>
                <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent Activity</h2>
            </div>
            <div className="divide-y divide-border/40">
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                activity.slice(0, 15).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-primary/60 mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{entry.taskTitle}{entry.detail ? ` — ${entry.detail}` : ""}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team list */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">Team Members</h2>
            </div>
            <div className="divide-y divide-border/40">
              {members.map((m) => {
                const initials = m.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                return (
                  <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-muted-foreground">{m.role}</p>
                    </div>
                    <Badge variant="outline" className="text-xs capitalize">
                      active
                    </Badge>
                  </div>
                )
              })}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}