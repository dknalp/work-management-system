"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ClipboardListIcon, ArrowRightIcon, AlertCircleIcon } from "lucide-react"
import { useTasks } from "@/contexts/task-context"
import { useMemo } from "react"
import { format, isToday, isTomorrow, parseISO } from "date-fns"
import { cn } from "@/lib/utils"
import Link from "next/link"

export function UpcomingTasks() {
  const { tasks } = useTasks()

  const upcoming = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10)
    return tasks
      .filter((t) => t.status !== "done" && t.due_date)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 6)
      .map((t) => {
        const isOverdue = t.due_date < todayStr
        const parsed = parseISO(t.due_date)
        let dueDateLabel = format(parsed, "MMM d")
        if (isToday(parsed)) dueDateLabel = "Bugün"
        else if (isTomorrow(parsed)) dueDateLabel = "Yarın"
        return { ...t, isOverdue, dueDateLabel }
      })
  }, [tasks])

  const priorityColors: Record<string, string> = {
    high: "border-rose-500/30 text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40",
    medium: "border-amber-500/30 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
    low: "border-slate-400/30 text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/40",
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-base font-semibold">Yaklaşan Görevler</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/tasks">
            Tümünü gör
            <ArrowRightIcon className="size-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="flex-1 px-6 pb-4">
        {upcoming.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-10">
            <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
              <ClipboardListIcon className="size-7 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground">Yaklaşan görev yok</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  {task.isOverdue ? (
                    <AlertCircleIcon className="size-3.5 shrink-0 text-destructive" />
                  ) : (
                    <div className="size-1.5 shrink-0 rounded-full bg-primary/50" />
                  )}
                  <span className={cn("truncate text-sm", task.isOverdue && "text-destructive")}>
                    {task.title}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn("h-5 px-1.5 text-[10px] font-medium", priorityColors[task.priority])}
                  >
                    {task.priority}
                  </Badge>
                  <span className={cn(
                    "text-xs whitespace-nowrap",
                    task.isOverdue ? "font-medium text-destructive" : "text-muted-foreground"
                  )}>
                    {task.due_dateLabel}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}