"use client"

import { addDays, differenceInCalendarDays, format, isAfter, isBefore, parseISO } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarClock, Clock } from "lucide-react"
import { useTasks } from "@/contexts/task-context"

const PRIORITY_BADGE: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800/40",
  medium: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800/40",
  low: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-900/30 dark:text-slate-400 dark:border-slate-700/40",
}

const PRIORITY_LABEL: Record<string, string> = {
  high: "Yüksek",
  medium: "Orta",
  low: "Düşük",
}

function daysRemainingBadge(daysLeft: number) {
  if (daysLeft < 0) return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
  if (daysLeft === 0) return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400"
  if (daysLeft <= 3) return "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400"
  if (daysLeft <= 5) return "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
  return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
}

function daysLabel(daysLeft: number): string {
  if (daysLeft < 0) return "Gecikmiş"
  if (daysLeft === 0) return "Bugün!"
  if (daysLeft === 1) return "Yarın"
  return `${daysLeft} gün kaldı`
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export function DeadlineTracker() {
  const { tasks } = useTasks()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = addDays(today, 7)

  const overdue = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.dueDate &&
      isBefore(parseISO(t.dueDate), today)
  )

  const upcoming = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.dueDate &&
      !isBefore(parseISO(t.dueDate), today) &&
      !isAfter(parseISO(t.dueDate), in7Days)
  )

  const allDeadlines = [
    ...overdue.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    ...upcoming.sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
  ]

  if (allDeadlines.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Yaklaşan Son Tarihler</h2>
        <span className="flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {allDeadlines.length}
        </span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scroll-smooth">
        {allDeadlines.map((task) => {
          const parsedDate = parseISO(task.dueDate)
          const daysLeft = differenceInCalendarDays(parsedDate, today)
          const formattedDate = format(parsedDate, "d MMM", { locale: tr })

          return (
            <div
              key={task.id}
              className="min-w-[210px] max-w-[210px] flex-shrink-0 rounded-xl bg-card ring-1 ring-foreground/10 p-4 flex flex-col gap-3"
            >
              {/* Days remaining badge */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${daysRemainingBadge(daysLeft)}`}
                >
                  {daysLabel(daysLeft)}
                </span>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${PRIORITY_BADGE[task.priority]}`}
                >
                  {PRIORITY_LABEL[task.priority]}
                </span>
              </div>

              {/* Task title */}
              <p className="text-sm font-medium leading-snug line-clamp-2">
                {task.title}
              </p>

              {/* Footer: date + assignees */}
              <div className="flex items-center justify-between mt-auto">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="size-3" />
                  <span>{formattedDate}</span>
                </div>

                {task.assignees.length > 0 && (
                  <div className="flex -space-x-1.5">
                    {task.assignees.slice(0, 3).map((name, i) => (
                      <div
                        key={i}
                        title={name}
                        className="flex size-6 items-center justify-center rounded-full bg-muted ring-2 ring-card text-[9px] font-bold text-muted-foreground uppercase"
                      >
                        {getInitials(name)}
                      </div>
                    ))}
                    {task.assignees.length > 3 && (
                      <div className="flex size-6 items-center justify-center rounded-full bg-muted ring-2 ring-card text-[9px] font-bold text-muted-foreground">
                        +{task.assignees.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}