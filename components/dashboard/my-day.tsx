"use client"

import { useState } from "react"
import Link from "next/link"
import { MOCK_TASKS, type Task } from "@/components/tasks/task-types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRightIcon, CircleDotIcon, CircleIcon, CheckCircle2Icon } from "lucide-react"
import { cn } from "@/lib/utils"

const TODAY = "2026-05-07"
const CURRENT_USER = "Alex Johnson"

function diffDays(dateStr: string) {
  return Math.round((new Date(dateStr).getTime() - new Date(TODAY).getTime()) / 86400000)
}

function formatDue(dateStr: string) {
  const d = diffDays(dateStr)
  if (d === 0) return "Bugün"
  if (d === 1) return "Yarın"
  if (d === -1) return "Dün"
  if (d < 0) return `${Math.abs(d)} gün gecikti`
  return `${d} gün sonra`
}

const myActiveTasks = MOCK_TASKS.filter(t => t.assignee === CURRENT_USER && t.status !== "done")

const tabs = [
  {
    key: "overdue",
    label: "Geciken",
    tasks: myActiveTasks.filter(t => t.dueDate < TODAY),
    emptyText: "Geciken task yok.",
    urgent: true,
  },
  {
    key: "today",
    label: "Bugün",
    tasks: myActiveTasks.filter(t => t.dueDate === TODAY),
    emptyText: "Bugün vadesi dolan task yok.",
    urgent: false,
  },
  {
    key: "priority",
    label: "Öncelikli",
    tasks: myActiveTasks.filter(t => t.priority === "high"),
    emptyText: "Öncelikli task yok.",
    urgent: false,
  },
  {
    key: "upcoming",
    label: "Yaklaşan",
    tasks: myActiveTasks.filter(t => { const d = diffDays(t.dueDate); return d > 0 && d <= 7 }),
    emptyText: "Önümüzdeki 7 günde vadesi dolan task yok.",
    urgent: false,
  },
  {
    key: "new",
    label: "Yeni Atamalar",
    tasks: MOCK_TASKS.filter(t => {
      const created = new Date(t.createdAt)
      const cutoff = new Date(TODAY)
      cutoff.setDate(cutoff.getDate() - 7)
      return t.assignee === CURRENT_USER && created >= cutoff && t.status !== "done"
    }),
    emptyText: "Son 7 günde yeni atama yok.",
    urgent: false,
  },
] as const

type TabKey = typeof tabs[number]["key"]

const priorityDot: Record<string, string> = {
  high: "bg-red-400",
  medium: "bg-amber-400",
  low: "bg-slate-300",
}

const statusIcon = (status: Task["status"]) => {
  if (status === "in-progress") return <CircleDotIcon className="size-3.5 text-blue-400 shrink-0" />
  if (status === "done") return <CheckCircle2Icon className="size-3.5 text-emerald-400 shrink-0" />
  return <CircleIcon className="size-3.5 text-muted-foreground/40 shrink-0" />
}

function TaskRow({ task }: { task: Task }) {
  const diff = diffDays(task.dueDate)
  const overdue = diff < 0
  return (
    <div className="flex items-center gap-3 py-3 border-b border-border/50 last:border-0 group">
      {statusIcon(task.status)}
      <span className="flex-1 text-sm text-foreground leading-snug">
        {task.title}
      </span>
      <div className="flex items-center gap-2.5 shrink-0">
        <span className={cn("size-1.5 rounded-full", priorityDot[task.priority])} />
        <span className={cn(
          "text-xs tabular-nums min-w-[72px] text-right",
          overdue ? "text-red-500 font-medium" : "text-muted-foreground"
        )}>
          {formatDue(task.dueDate)}
        </span>
      </div>
    </div>
  )
}

export function MyDay() {
  const [active, setActive] = useState<TabKey>("overdue")
  const currentTab = tabs.find(t => t.key === active)!

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-0">
        <div className="space-y-0.5">
          <CardTitle className="text-base font-semibold">Bana Atananlar</CardTitle>
          <CardDescription className="text-xs">{CURRENT_USER}</CardDescription>
        </div>
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Tüm taskler
          <ArrowRightIcon className="size-3" />
        </Link>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-border mb-4 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActive(tab.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                active === tab.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.tasks.length > 0 && (
                <Badge
                  variant="secondary"
                  className={cn(
                    "text-xs h-4 min-w-4 px-1 rounded-full font-medium",
                    tab.urgent && tab.tasks.length > 0
                      ? "bg-red-100 text-red-600"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {tab.tasks.length}
                </Badge>
              )}
            </button>
          ))}
        </div>

        {/* Task list */}
        {currentTab.tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {currentTab.emptyText}
          </p>
        ) : (
          <div>
            {currentTab.tasks.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}