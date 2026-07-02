"use client"

import { useEffect, useMemo, useState } from "react"
import { CheckCircle2, Clock, AlertCircle, ListTodo } from "lucide-react"
import { useTasks } from "@/contexts/task-context"
import { cn } from "@/lib/utils"
import { isAfter, parseISO, startOfToday } from "date-fns"
import { apiClient } from "@/lib/api"
import { MOCK_AUTH } from "@/contexts/auth-context"

type ApiStats = {
  total: number
  todo: number
  in_progress: number
  done: number
  overdue: number
  completion_rate: number
}

export function StatsCards() {
  const { tasks } = useTasks()
  const [apiStats, setApiStats] = useState<ApiStats | null>(null)

  useEffect(() => {
    if (MOCK_AUTH) return
    apiClient<ApiStats>("/api/v1/analytics/summary").then(setApiStats).catch(() => {})
  }, [])

  const mockStats = useMemo(() => {
    const today = startOfToday()
    const total = tasks.length
    const done = tasks.filter((t) => t.status === "done").length
    const inProgress = tasks.filter((t) => t.status === "in-progress").length
    const overdue = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && isAfter(today, parseISO(t.dueDate))
    ).length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0
    return { total, done, inProgress, overdue, completionRate }
  }, [tasks])

  const stats = apiStats
    ? {
        total: apiStats.total,
        done: apiStats.done,
        inProgress: apiStats.in_progress,
        overdue: apiStats.overdue,
        completionRate: Math.round(apiStats.completion_rate),
      }
    : mockStats

  const cards = [
    {
      label: "Toplam Görev",
      value: stats.total,
      sub: `%${stats.completionRate} tamamlandı`,
      icon: ListTodo,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      label: "Devam Ediyor",
      value: stats.inProgress,
      sub: "şu an aktif",
      icon: Clock,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Tamamlanan",
      value: stats.done,
      sub: `toplam ${stats.total} içinden`,
      icon: CheckCircle2,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Gecikmiş",
      value: stats.overdue,
      sub: stats.overdue === 0 ? "hepsi yolunda" : "son tarihi geçmiş",
      icon: AlertCircle,
      color: stats.overdue > 0 ? "text-rose-500" : "text-muted-foreground",
      bg: stats.overdue > 0 ? "bg-rose-500/10" : "bg-muted/40",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.label}
            className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm"
          >
            <div
              className={cn(
                "flex size-11 flex-shrink-0 items-center justify-center rounded-xl",
                card.bg
              )}
            >
              <Icon className={cn("size-5", card.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{card.value}</p>
              <p className="mt-0.5 text-xs font-medium text-muted-foreground">{card.label}</p>
              <p className="text-[11px] text-muted-foreground/60">{card.sub}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}