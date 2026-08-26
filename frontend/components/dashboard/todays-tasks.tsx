"use client"

import { useState } from "react"
import { format } from "date-fns"
import { CheckCircle2, Circle, Plus, PartyPopper } from "lucide-react"
import { useTasks } from "@/contexts/task-context"
import { Button } from "@/components/ui/button"
import { CreateTaskDialog } from "@/components/create-task-dialog"

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  low: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700/40",
}

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }

const PRIORITY_LABEL: Record<string, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
}

export function TodaysTasks() {
  const { tasks, updateTask } = useTasks()
  const [createOpen, setCreateOpen] = useState(false)

  const today = format(new Date(), "yyyy-MM-dd")
  const todaysTasks = tasks
    .filter((t) => t.due_date?.startsWith(today))
    .sort((a, b) => {
      if (a.status === "done" && b.status !== "done") return 1
      if (a.status !== "done" && b.status === "done") return -1
      return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
    })

  const completedCount = todaysTasks.filter((t) => t.status === "done").length
  const total = todaysTasks.length
  const progress = total > 0 ? Math.round((completedCount / total) * 100) : 0

  function toggleTask(id: string, currentStatus: string) {
    updateTask(id, {
      status: currentStatus === "done" ? "todo" : "done",
      ...(currentStatus !== "done" ? { completed_at: new Date().toISOString() } : {}),
    })
  }

  return (
    <div className="flex flex-col rounded-2xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">Bugünün Görevleri</h2>
          <span className="text-xs text-muted-foreground tabular-nums">
            {completedCount}/{total}
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto max-h-[300px] px-5 py-2 divide-y divide-border/40">
        {todaysTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <PartyPopper className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Bugün için planlanmış görev yok 🎉
            </p>
          </div>
        ) : (
          todaysTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center gap-3 py-2.5 group"
            >
              <button
                onClick={() => toggleTask(task.id, task.status)}
                className="shrink-0 text-muted-foreground hover:text-emerald-500 transition-colors"
                aria-label={task.status === "done" ? "Geri al" : "Tamamla"}
              >
                {task.status === "done" ? (
                  <CheckCircle2 className="size-5 text-emerald-500" />
                ) : (
                  <Circle className="size-5" />
                )}
              </button>

              <span
                className={`flex-1 text-sm truncate ${
                  task.status === "done"
                    ? "line-through text-muted-foreground"
                    : ""
                }`}
              >
                {task.title}
              </span>

              <span
                className={`shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${
                  PRIORITY_BADGE[task.priority]
                }`}
              >
                {PRIORITY_LABEL[task.priority]}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-2 border-t border-border/60">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          Görev ekle
        </Button>
      </div>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}