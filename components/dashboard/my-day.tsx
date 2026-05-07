"use client"

import Link from "next/link"
import { MOCK_TASKS, type Task } from "@/components/tasks/task-types"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircleIcon, CalendarClockIcon, FlagIcon, UserCheckIcon, CalendarDaysIcon, ArrowRightIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const TODAY = "2026-05-07"
const CURRENT_USER = "Alex Johnson"

function diffDays(dateStr: string) {
  const d = new Date(dateStr)
  const t = new Date(TODAY)
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

function formatDue(dateStr: string) {
  const diff = diffDays(dateStr)
  if (diff === 0) return "Bugün"
  if (diff === 1) return "Yarın"
  if (diff === -1) return "Dün"
  if (diff < 0) return `${Math.abs(diff)} gün önce`
  return `${diff} gün sonra`
}

const myTasks = MOCK_TASKS.filter(t => t.assignee === CURRENT_USER && t.status !== "done")

const todayTasks   = myTasks.filter(t => t.dueDate === TODAY)
const overdueTasks = myTasks.filter(t => t.dueDate < TODAY)
const highTasks    = myTasks.filter(t => t.priority === "high" && t.dueDate > TODAY)
const newTasks     = MOCK_TASKS.filter(t => {
  const created = new Date(t.createdAt)
  const cutoff  = new Date(TODAY)
  cutoff.setDate(cutoff.getDate() - 7)
  return t.assignee === CURRENT_USER && created >= cutoff && t.status !== "done"
})
const upcomingTasks = myTasks.filter(t => {
  const diff = diffDays(t.dueDate)
  return diff > 0 && diff <= 7
})

const priorityColors: Record<string, string> = {
  high:   "bg-red-50 text-red-600 border-red-200",
  medium: "bg-amber-50 text-amber-600 border-amber-200",
  low:    "bg-slate-50 text-slate-500 border-slate-200",
}

const priorityLabels: Record<string, string> = {
  high: "Yüksek", medium: "Orta", low: "Düşük",
}

function TaskRow({ task, showDue = true }: { task: Task; showDue?: boolean }) {
  const diff = diffDays(task.dueDate)
  const isOverdue = diff < 0
  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className={cn(
        "mt-0.5 size-1.5 shrink-0 rounded-full",
        task.status === "in-progress" ? "bg-blue-400" : "bg-muted-foreground/30"
      )} />
      <span className="flex-1 truncate text-sm text-foreground group-hover:text-foreground/80">
        {task.title}
      </span>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={cn("text-xs px-1.5 py-0", priorityColors[task.priority])}>
          {priorityLabels[task.priority]}
        </Badge>
        {showDue && (
          <span className={cn(
            "text-xs tabular-nums",
            isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"
          )}>
            {formatDue(task.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}

interface SectionProps {
  icon: React.ReactNode
  title: string
  tasks: Task[]
  emptyText: string
  iconColor: string
  showDue?: boolean
}

function Section({ icon, title, tasks, emptyText, iconColor, showDue }: SectionProps) {
  return (
    <div className="space-y-1">
      <div className={cn("flex items-center gap-2 mb-2", iconColor)}>
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
        {tasks.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">{tasks.length}</span>
        )}
      </div>
      {tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground py-1.5 pl-5">{emptyText}</p>
      ) : (
        <div className="divide-y divide-border/50">
          {tasks.slice(0, 4).map(t => (
            <TaskRow key={t.id} task={t} showDue={showDue} />
          ))}
          {tasks.length > 4 && (
            <p className="pt-2 text-xs text-muted-foreground pl-5">+{tasks.length - 4} daha</p>
          )}
        </div>
      )}
    </div>
  )
}

export function MyDay() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">Bugün / Bana Atananlar</CardTitle>
          <CardDescription className="text-xs">
            Giriş yaptığınızda görmeniz gerekenler — {CURRENT_USER}
          </CardDescription>
        </div>
        <Link
          href="/tasks"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Tüm taskler
          <ArrowRightIcon className="size-3" />
        </Link>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Col 1 */}
          <div className="space-y-6">
            <Section
              icon={<AlertCircleIcon className="size-3.5" />}
              iconColor="text-red-500"
              title="Geciken Taskler"
              tasks={overdueTasks}
              emptyText="Geciken task yok"
              showDue
            />
            <Section
              icon={<CalendarClockIcon className="size-3.5" />}
              iconColor="text-amber-500"
              title="Bugünkü Taskler"
              tasks={todayTasks}
              emptyText="Bugün vadesi dolan task yok"
              showDue={false}
            />
          </div>

          {/* Col 2 */}
          <div className="space-y-6">
            <Section
              icon={<FlagIcon className="size-3.5" />}
              iconColor="text-orange-500"
              title="Öncelikli Taskler"
              tasks={highTasks}
              emptyText="Öncelikli task yok"
              showDue
            />
            <Section
              icon={<UserCheckIcon className="size-3.5" />}
              iconColor="text-violet-500"
              title="Son 7 Günde Atananlar"
              tasks={newTasks}
              emptyText="Son 7 günde yeni atama yok"
              showDue
            />
          </div>

          {/* Col 3 */}
          <div>
            <Section
              icon={<CalendarDaysIcon className="size-3.5" />}
              iconColor="text-sky-500"
              title="Yaklaşan (7 gün)"
              tasks={upcomingTasks}
              emptyText="Önümüzdeki 7 günde vadesi dolan task yok"
              showDue
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}