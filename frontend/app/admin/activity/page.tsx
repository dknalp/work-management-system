"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { useAuth } from "@/contexts/auth-context"
import { useTasks, type ActivityType } from "@/contexts/task-context"
import { ActivityIcon, ArrowLeftIcon, SearchIcon, XIcon } from "lucide-react"
import { redirect } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const ACTION_LABELS: Record<ActivityType, string> = {
  task_created: "created",
  task_completed: "completed",
  task_reopened: "reopened",
  task_status_changed: "updated status of",
  task_deleted: "deleted",
  task_updated: "updated",
}

const ACTION_COLORS: Record<ActivityType, string> = {
  task_created: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  task_completed: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  task_reopened: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  task_status_changed: "bg-violet-500/20 text-violet-600 dark:text-violet-400",
  task_deleted: "bg-red-500/20 text-red-600 dark:text-red-400",
  task_updated: "bg-slate-500/20 text-slate-600 dark:text-slate-400",
}

const ACTION_BADGE_VARIANTS: Record<ActivityType, string> = {
  task_created: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  task_completed: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  task_reopened: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  task_status_changed: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  task_deleted: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
  task_updated: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

const USER_AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-600 dark:text-violet-400",
  "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  "bg-rose-500/20 text-rose-600 dark:text-rose-400",
  "bg-cyan-500/20 text-cyan-600 dark:text-cyan-400",
]

function getUserColor(userId: string | null | undefined, index: number) {
  if (!userId) return "bg-primary/10 text-primary"
  return USER_AVATAR_COLORS[index % USER_AVATAR_COLORS.length]
}

export default function ActivityLogPage() {
  const { user, loading } = useAuth()
  const { activity } = useTasks()

  const [search, setSearch] = useState("")
  const [filterUser, setFilterUser] = useState<string>("all")
  const [filterAction, setFilterAction] = useState<string>("all")

  if (loading) return null
  if (!user?.is_admin) redirect("/dashboard")

  // Build unique user list from activity entries
  const uniqueUsers = useMemo(() => {
    const map = new Map<string, { id: string | null; name: string; count: number; colorIndex: number }>()
    let colorIndex = 0
    activity.forEach((entry) => {
      const key = entry.userId ?? `__unknown__${entry.userName}`
      if (!map.has(key)) {
        map.set(key, {
          id: entry.userId ?? null,
          name: entry.userName ?? "Unknown User",
          count: 0,
          colorIndex: colorIndex++,
        })
      }
      map.get(key)!.count++
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [activity])

  // Build user color lookup by userId
  const userColorMap = useMemo(() => {
    const m = new Map<string | null, string>()
    uniqueUsers.forEach((u) => {
      m.set(u.id, getUserColor(u.id, u.colorIndex))
    })
    return m
  }, [uniqueUsers])

  const filtered = useMemo(() => {
    return activity.filter((entry) => {
      if (filterUser !== "all") {
        const key = entry.userId ?? `__unknown__${entry.userName}`
        if (key !== filterUser) return false
      }
      if (filterAction !== "all" && entry.type !== filterAction) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const nameMatch = (entry.userName ?? "").toLowerCase().includes(q)
        const titleMatch = entry.taskTitle.toLowerCase().includes(q)
        if (!nameMatch && !titleMatch) return false
      }
      return true
    })
  }, [activity, filterUser, filterAction, search])

  const hasFilters = filterUser !== "all" || filterAction !== "all" || search.trim() !== ""

  function clearFilters() {
    setSearch("")
    setFilterUser("all")
    setFilterAction("all")
  }

  // Build user key map for select value matching
  const userKeyMap = useMemo(() => {
    const m = new Map<string, string>()
    activity.forEach((entry) => {
      const key = entry.userId ?? `__unknown__${entry.userName}`
      m.set(key, entry.userName ?? "Unknown User")
    })
    return m
  }, [activity])

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">

          {/* Back link */}
          <div>
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors w-fit"
            >
              <ArrowLeftIcon className="size-3.5" />
              Admin Panel
            </Link>
          </div>

          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ActivityIcon className="size-4" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Activity Log</h1>
                <p className="text-sm text-muted-foreground">
                  {hasFilters
                    ? `${filtered.length} of ${activity.length} events`
                    : `${activity.length} event${activity.length !== 1 ? "s" : ""} recorded`}
                </p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="rounded-xl border border-border/60 bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[200px] flex-1">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search by person or task…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              {/* User filter */}
              <Select value={filterUser} onValueChange={setFilterUser}>
                <SelectTrigger className="h-9 w-[180px] shrink-0">
                  <SelectValue placeholder="All people" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All people</SelectItem>
                  {uniqueUsers.map((u) => {
                    const key = u.id ?? `__unknown__${u.name}`
                    return (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <span className={`inline-flex size-5 items-center justify-center rounded-full text-[10px] font-bold ${getUserColor(u.id, u.colorIndex)}`}>
                            {getInitials(u.name)}
                          </span>
                          <span>{u.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{u.count}</span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              {/* Action type filter */}
              <Select value={filterAction} onValueChange={setFilterAction}>
                <SelectTrigger className="h-9 w-[180px] shrink-0">
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  {(Object.keys(ACTION_LABELS) as ActivityType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[type]}`}>
                        {ACTION_LABELS[type]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear filters */}
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="h-9 gap-1.5 text-muted-foreground hover:text-foreground"
                >
                  <XIcon className="size-3.5" />
                  Clear
                </Button>
              )}
            </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filterUser !== "all" && (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 pr-1 cursor-pointer"
                    onClick={() => setFilterUser("all")}
                  >
                    {userKeyMap.get(filterUser) ?? filterUser}
                    <XIcon className="size-3" />
                  </Badge>
                )}
                {filterAction !== "all" && (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 pr-1 cursor-pointer"
                    onClick={() => setFilterAction("all")}
                  >
                    {ACTION_LABELS[filterAction as ActivityType]}
                    <XIcon className="size-3" />
                  </Badge>
                )}
                {search.trim() && (
                  <Badge
                    variant="secondary"
                    className="gap-1.5 pr-1 cursor-pointer"
                    onClick={() => setSearch("")}
                  >
                    &ldquo;{search}&rdquo;
                    <XIcon className="size-3" />
                  </Badge>
                )}
              </div>
            )}
          </div>

          {/* Activity list */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="divide-y divide-border/40">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
                  <ActivityIcon className="size-8 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {hasFilters ? "No events match the current filters." : "No activity yet."}
                  </p>
                  {hasFilters && (
                    <button
                      onClick={clearFilters}
                      className="mt-1 text-xs text-primary hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                filtered.map((entry) => {
                  const name = entry.userName ?? "Unknown User"
                  const initials = getInitials(name)
                  const avatarColor = userColorMap.get(entry.userId ?? null) ?? "bg-primary/10 text-primary"
                  const actionLabel = ACTION_LABELS[entry.type]
                  const actionColor = ACTION_COLORS[entry.type]

                  return (
                    <div key={entry.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                      {/* User avatar */}
                      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}>
                        {initials}
                      </div>

                      {/* Content */}
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-medium text-foreground">{name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionColor}`}>
                          {actionLabel}
                        </span>
                        <span className="truncate text-sm text-foreground">
                          &ldquo;{entry.taskTitle}&rdquo;
                        </span>
                        {entry.detail && (
                          <span className="text-xs text-muted-foreground">— {entry.detail}</span>
                        )}
                      </div>

                      {/* Timestamp */}
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}