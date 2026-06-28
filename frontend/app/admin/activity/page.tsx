"use client"

import React, { useMemo, useState } from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { useAuth } from "@/contexts/auth-context"
import { useTasks, type ActivityType, type ActivityEntry } from "@/contexts/task-context"
import { ActivityIcon, ArrowLeftIcon, SearchIcon } from "lucide-react"
import { redirect } from "next/navigation"
import { Input } from "@/components/ui/input"

// ── Constants ─────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<ActivityType, string> = {
  task_created: "oluşturdu",
  task_completed: "tamamladı",
  task_reopened: "yeniden açtı",
  task_status_changed: "durumunu değiştirdi",
  task_deleted: "sildi",
  task_updated: "güncelledi",
}

const ACTION_COLORS: Record<ActivityType, string> = {
  task_created: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  task_completed: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  task_reopened: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  task_status_changed: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  task_deleted: "bg-red-500/15 text-red-600 dark:text-red-400",
  task_updated: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
}

const AVATAR_COLORS = [
  "bg-violet-500/20 text-violet-700 dark:text-violet-300",
  "bg-blue-500/20 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  "bg-rose-500/20 text-rose-700 dark:text-rose-300",
  "bg-cyan-500/20 text-cyan-700 dark:text-cyan-300",
  "bg-orange-500/20 text-orange-700 dark:text-orange-300",
  "bg-indigo-500/20 text-indigo-700 dark:text-indigo-300",
]

type TimeRange = "today" | "week" | "month" | "all"

const TIME_LABELS: Record<TimeRange, string> = {
  today: "Bugün",
  week: "Bu Hafta",
  month: "Bu Ay",
  all: "Tümü",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

function avatarColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length]
}

function getCutoff(range: TimeRange): Date | null {
  const now = new Date()
  if (range === "today") {
    const d = new Date(now); d.setHours(0, 0, 0, 0); return d
  }
  if (range === "week") {
    const d = new Date(now)
    const day = d.getDay()
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    d.setHours(0, 0, 0, 0)
    return d
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
  }
  return null
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "az önce"
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa önce`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "dün"
  if (days < 7) return `${days} gün önce`
  return new Date(iso).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
}

function groupLabel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return "Bugün"
  if (days === 1) return "Dün"
  if (days < 7) return "Bu Hafta"
  if (days < 30) return "Bu Ay"
  return "Daha Önce"
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const { user, loading } = useAuth()
  const { activity } = useTasks()

  const [timeRange, setTimeRange] = useState<TimeRange>("all")
  const [selectedUser, setSelectedUser] = useState<string>("all") // "all" or userName
  const [search, setSearch] = useState("")

  // All useMemo hooks before any early returns
  const inRange = useMemo(() => {
    const cutoff = getCutoff(timeRange)
    if (!cutoff) return activity
    return activity.filter((e) => new Date(e.timestamp) >= cutoff)
  }, [activity, timeRange])

  // Build person list from activity in current time range
  const persons = useMemo(() => {
    const map = new Map<string, { name: string; count: number; colorIdx: number }>()
    let ci = 0
    inRange.forEach((e) => {
      const name = e.userName ?? "Bilinmeyen"
      if (!map.has(name)) map.set(name, { name, count: 0, colorIdx: ci++ })
      map.get(name)!.count++
    })
    return Array.from(map.values()).sort((a, b) => b.count - a.count)
  }, [inRange])

  // Color index lookup by name (stable across renders)
  const colorByName = useMemo(() => {
    const m = new Map<string, number>()
    persons.forEach((p) => m.set(p.name, p.colorIdx))
    return m
  }, [persons])

  // Filtered feed
  const feed = useMemo(() => {
    return inRange.filter((e) => {
      if (selectedUser !== "all" && (e.userName ?? "Bilinmeyen") !== selectedUser) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        if (
          !(e.userName ?? "").toLowerCase().includes(q) &&
          !e.taskTitle.toLowerCase().includes(q)
        ) return false
      }
      return true
    })
  }, [inRange, selectedUser, search])

  // Grouped feed (only when timeRange = "all", to show date section headers)
  const groupedFeed = useMemo(() => {
    if (timeRange !== "all") return null
    const groups: { label: string; entries: ActivityEntry[] }[] = []
    const order = ["Bugün", "Dün", "Bu Hafta", "Bu Ay", "Daha Önce"]
    const map = new Map<string, ActivityEntry[]>()
    feed.forEach((e) => {
      const label = groupLabel(e.timestamp)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(e)
    })
    order.forEach((label) => {
      const entries = map.get(label)
      if (entries) groups.push({ label, entries })
    })
    return groups
  }, [feed, timeRange])

  if (loading) return null
  if (!user?.is_admin) redirect("/dashboard")

  const selectedPersonName = selectedUser === "all"
    ? null
    : persons.find((p) => p.name === selectedUser)?.name ?? selectedUser

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col h-[calc(100vh-3.5rem)]">

          {/* Top bar */}
          <div className="flex items-center gap-4 border-b border-border/60 px-6 py-3 shrink-0">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeftIcon className="size-3.5" />
              Admin Panel
            </Link>

            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                <ActivityIcon className="size-3.5" />
              </div>
              <h1 className="text-sm font-semibold">Activity Log</h1>
            </div>

            <div className="ml-auto flex items-center gap-1 rounded-lg border border-border/60 p-0.5">
              {(["today", "week", "month", "all"] as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={[
                    "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                    timeRange === range
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  {TIME_LABELS[range]}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden">

            {/* Left panel — person list */}
            <aside className="w-56 shrink-0 border-r border-border/60 flex flex-col overflow-y-auto">
              <div className="px-3 py-3">
                <p className="px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Çalışanlar
                </p>

                {/* All team */}
                <button
                  onClick={() => setSelectedUser("all")}
                  className={[
                    "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                    selectedUser === "all"
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted/40",
                  ].join(" ")}
                >
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
                    ∞
                  </div>
                  <span className="flex-1 truncate">Tüm Ekip</span>
                  <span className={[
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                    selectedUser === "all"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground",
                  ].join(" ")}>
                    {inRange.length}
                  </span>
                </button>

                {/* Per-person rows */}
                <div className="mt-1 space-y-0.5">
                  {persons.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                      Bu dönemde aktivite yok.
                    </p>
                  ) : (
                    persons.map((p) => {
                      const isSelected = selectedUser === p.name
                      const color = avatarColor(p.colorIdx)
                      return (
                        <button
                          key={p.name}
                          onClick={() => setSelectedUser(isSelected ? "all" : p.name)}
                          className={[
                            "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors",
                            isSelected
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-foreground hover:bg-muted/40",
                          ].join(" ")}
                        >
                          <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${color}`}>
                            {initials(p.name)}
                          </div>
                          <span className="flex-1 truncate">{p.name.split(" ")[0]}</span>
                          <span className={[
                            "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
                            isSelected
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground",
                          ].join(" ")}>
                            {p.count}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </div>
            </aside>

            {/* Right panel — activity feed */}
            <div className="flex flex-1 flex-col overflow-hidden">

              {/* Feed header */}
              <div className="flex items-center gap-3 border-b border-border/40 px-5 py-3 shrink-0">
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {selectedPersonName
                      ? `${selectedPersonName} · ${TIME_LABELS[timeRange]}`
                      : `Tüm Ekip · ${TIME_LABELS[timeRange]}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {feed.length} işlem
                  </p>
                </div>

                {/* Search */}
                <div className="relative w-56">
                  <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    placeholder="Görev veya kişi ara…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
              </div>

              {/* Feed list */}
              <div className="flex-1 overflow-y-auto">
                {feed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
                    <ActivityIcon className="size-10 opacity-20" />
                    <p className="text-sm">Bu dönemde aktivite yok.</p>
                    {(selectedUser !== "all" || search.trim()) && (
                      <button
                        onClick={() => { setSelectedUser("all"); setSearch("") }}
                        className="text-xs text-primary hover:underline"
                      >
                        Filtreyi temizle
                      </button>
                    )}
                  </div>
                ) : timeRange === "all" && groupedFeed ? (
                  // Grouped view
                  <div className="px-5 py-4 space-y-6">
                    {groupedFeed.map(({ label, entries }) => (
                      <div key={label}>
                        <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        <div className="space-y-1">
                          {entries.map((e) => (
                            <FeedRow key={e.id} entry={e} colorIdx={colorByName.get(e.userName ?? "") ?? 0} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  // Flat view
                  <div className="px-5 py-4 space-y-1">
                    {feed.map((e) => (
                      <FeedRow key={e.id} entry={e} colorIdx={colorByName.get(e.userName ?? "") ?? 0} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

// ── FeedRow ───────────────────────────────────────────────────────────────────

function FeedRow({ entry, colorIdx }: { entry: ActivityEntry; colorIdx: number }) {
  const name = entry.userName ?? "Bilinmeyen"
  const color = AVATAR_COLORS[colorIdx % AVATAR_COLORS.length]
  const actionLabel = ACTION_LABELS[entry.type]
  const actionColor = ACTION_COLORS[entry.type]

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors -mx-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold mt-0.5 ${color}`}>
        {initials(name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${actionColor}`}>
            {actionLabel}
          </span>
          <span className="text-sm text-foreground truncate max-w-xs">
            &ldquo;{entry.taskTitle}&rdquo;
          </span>
        </div>
        {entry.detail && (
          <p className="mt-0.5 text-xs text-muted-foreground">{entry.detail}</p>
        )}
      </div>

      <span
        className="shrink-0 text-xs text-muted-foreground tabular-nums mt-0.5 whitespace-nowrap"
        title={new Date(entry.timestamp).toLocaleString("tr-TR")}
      >
        {relativeTime(entry.timestamp)}
      </span>
    </div>
  )
}