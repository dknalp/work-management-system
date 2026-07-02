"use client"

import { useMemo } from "react"
import { KanbanIcon, CheckCircle2Icon, ClockIcon, AlertTriangleIcon, LayersIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface KanbanCard {
  id: string
  title: string
  status: string
  priority: string
  createdAt: string
}

interface KanbanData {
  columns: { id: string; title: string }[]
  cards: KanbanCard[]
}

function readKanbanData(storageKey: string): KanbanData {
  if (typeof window === "undefined") return { columns: [], cards: [] }
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { columns: [], cards: [] }
    return JSON.parse(raw)
  } catch {
    return { columns: [], cards: [] }
  }
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-rose-600 dark:text-rose-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-slate-500 dark:text-slate-400",
}

const PRIORITY_LABELS: Record<string, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
}

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  low: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700/40",
}

export function ProjectOverviewTab({ storageKey }: { storageKey: string }) {
  const data = useMemo(() => readKanbanData(storageKey), [storageKey])

  const total = data.cards.length
  const done = data.cards.filter((c) => c.status === "done").length
  const inProgress = data.cards.filter((c) => c.status === "in-progress").length
  const todo = data.cards.filter((c) => c.status === "todo" || (c.status !== "done" && c.status !== "in-progress")).length - inProgress
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  const recentCards = [...data.cards]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5)

  const kpis = [
    {
      label: "Toplam Kart",
      value: total,
      icon: LayersIcon,
      color: "text-blue-500",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Devam Ediyor",
      value: inProgress,
      icon: ClockIcon,
      color: "text-amber-500",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Tamamlandı",
      value: done,
      icon: CheckCircle2Icon,
      color: "text-emerald-500",
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
    },
    {
      label: "Bekliyor",
      value: Math.max(0, todo),
      icon: AlertTriangleIcon,
      color: "text-slate-400",
      bg: "bg-slate-50 dark:bg-slate-900/30",
    },
  ]

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="flex flex-col gap-3 rounded-xl bg-card ring-1 ring-foreground/10 p-4"
          >
            <div className={cn("flex size-8 items-center justify-center rounded-lg", bg)}>
              <Icon className={cn("size-4", color)} />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="rounded-xl bg-card ring-1 ring-foreground/10 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Genel İlerleme</p>
          <span className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {progress}%
          </span>
        </div>
        <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {done} / {total} kart tamamlandı
        </p>
      </div>

      {/* Recent Cards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <KanbanIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Son Eklenen Kartlar</h3>
        </div>

        {recentCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-xl bg-card ring-1 ring-foreground/10 text-center">
            <KanbanIcon className="size-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Henüz kart yok — Pipeline sekmesinden kart ekleyebilirsin.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50 rounded-xl bg-card ring-1 ring-foreground/10 overflow-hidden">
            {recentCards.map((card) => {
              const col = data.columns.find((c) => c.id === card.status)
              return (
                <div key={card.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm truncate", card.status === "done" && "line-through text-muted-foreground")}>
                      {card.title}
                    </p>
                    {col && (
                      <p className="text-[11px] text-muted-foreground mt-0.5">{col.title}</p>
                    )}
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded border",
                      PRIORITY_BADGE[card.priority] ?? PRIORITY_BADGE.low
                    )}
                  >
                    {PRIORITY_LABELS[card.priority] ?? card.priority}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}