"use client"

import React, { useState, useMemo } from "react"
import {
  format,
  parseISO,
  isToday,
  isSameDay,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  addDays,
  isSameMonth,
} from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
  CalendarDays,
} from "lucide-react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTasks } from "@/contexts/task-context"
import { Task, TaskPriority } from "@/types/task"
import { toast } from "sonner"

type CalendarTask = {
  id: string
  title: string
  date: string
  priority: "low" | "medium" | "high"
  completed: boolean
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
  high: "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30",
  urgent: "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30",
}

const CHIP_COLOR: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
  urgent: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

const DOT_COLOR: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
  urgent: "bg-rose-500",
}

function taskToPriority(p: string): "low" | "medium" | "high" {
  if (p === "urgent") return "high"
  return p as "low" | "medium" | "high"
}

function buildCalendarWeeks(year: number, month: number) {
  const firstOfMonth = new Date(year, month, 1)
  const gridStart = startOfWeek(firstOfMonth, { weekStartsOn: 0 })
  const weeks: { date: Date; isCurrentMonth: boolean }[][] = []
  let current = gridStart
  while (weeks.length < 6) {
    const week: { date: Date; isCurrentMonth: boolean }[] = []
    for (let d = 0; d < 7; d++) {
      week.push({ date: current, isCurrentMonth: isSameMonth(current, firstOfMonth) })
      current = addDays(current, 1)
    }
    weeks.push(week)
    if (weeks.length >= 4 && !isSameMonth(current, firstOfMonth)) break
  }
  return weeks
}

const DAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

export default function CalendarPage() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium")
  const [newTime, setNewTime] = useState("")

  const calendarTasks: CalendarTask[] = useMemo(
    () =>
      tasks
        .filter((t) => t.dueDate)
        .map((t) => ({
          id: t.id,
          title: t.title,
          date: t.dueDate,
          priority: taskToPriority(t.priority),
          completed: t.status === "done",
        })),
    [tasks]
  )

  const weeks = useMemo(
    () => buildCalendarWeeks(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  )

  const selectedDateStr = format(selectedDay, "yyyy-MM-dd")
  const tasksForSelectedDay = calendarTasks.filter((t) => t.date === selectedDateStr)

  const monthTaskCount = useMemo(
    () =>
      calendarTasks.filter((t) => {
        const d = parseISO(t.date)
        return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth)
      }).length,
    [calendarTasks, currentMonth]
  )

  const monthDoneCount = useMemo(
    () =>
      calendarTasks.filter((t) => {
        const d = parseISO(t.date)
        return (
          t.completed &&
          d >= startOfMonth(currentMonth) &&
          d <= endOfMonth(currentMonth)
        )
      }).length,
    [calendarTasks, currentMonth]
  )

  function handleAddTask() {
    if (!newTitle.trim()) return
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      status: "todo",
      priority: newPriority,
      assignee: "",
      dueDate: selectedDateStr,
      tags: [],
      createdAt: new Date().toISOString().slice(0, 10),
    }
    addTask(newTask)
    toast.success("Task added to calendar")
    setNewTitle("")
    setNewPriority("medium")
    setNewTime("")
    setShowAddForm(false)
  }

  function handleToggle(taskId: string) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask(taskId, { status: task.status === "done" ? "todo" : "done" })
  }

  function handleDelete(taskId: string) {
    deleteTask(taskId)
    toast.success("Task deleted")
  }

  const prevMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
  const nextMonth = () =>
    setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 overflow-hidden bg-background">
          <div className="flex flex-1 flex-col lg:flex-row overflow-hidden">

            {/* ── Left: Calendar grid ─────────────────────────────── */}
            <div className="flex flex-col lg:w-[52%] border-r border-border overflow-hidden">

              {/* Month header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={prevMonth} className="h-7 w-7">
                    <ChevronLeft size={15} />
                  </Button>
                  <h2 className="text-sm font-semibold w-32 text-center tabular-nums">
                    {format(currentMonth, "MMMM yyyy")}
                  </h2>
                  <Button variant="ghost" size="icon" onClick={nextMonth} className="h-7 w-7">
                    <ChevronRight size={15} />
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{monthTaskCount} tasks</span>
                  {monthDoneCount > 0 && (
                    <span className="text-emerald-600 font-medium">{monthDoneCount} done</span>
                  )}
                </div>
              </div>

              {/* Day-of-week header row */}
              <div className="grid grid-cols-7 border-b border-border shrink-0">
                {DAY_HEADERS.map((d) => (
                  <div
                    key={d}
                    className="py-2 text-center text-[11px] font-medium text-muted-foreground"
                  >
                    {d}
                  </div>
                ))}
              </div>

              {/* Calendar cells */}
              <div className="flex-1 overflow-y-auto">
                {weeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
                    {week.map(({ date, isCurrentMonth }) => {
                      const dayStr = format(date, "yyyy-MM-dd")
                      const dayTasks = calendarTasks.filter((t) => t.date === dayStr)
                      const isSelected = isSameDay(date, selectedDay)
                      const isTodayDate = isToday(date)

                      return (
                        <button
                          key={dayStr}
                          onClick={() => setSelectedDay(date)}
                          className={cn(
                            "relative flex flex-col items-start px-1.5 pt-1.5 pb-2 text-left",
                            "border-r border-border last:border-r-0",
                            "min-h-[90px] transition-colors",
                            "hover:bg-accent/50",
                            isSelected && "bg-primary/[0.06]",
                            !isCurrentMonth && "bg-muted/20"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-flex h-6 w-6 items-center justify-center rounded-full",
                              "text-xs font-medium mb-1 shrink-0",
                              !isCurrentMonth && "text-muted-foreground/50",
                              isCurrentMonth && !isTodayDate && !isSelected && "text-foreground",
                              isTodayDate && "bg-primary text-primary-foreground",
                              isSelected && !isTodayDate && "ring-1 ring-primary text-primary"
                            )}
                          >
                            {format(date, "d")}
                          </span>

                          {dayTasks.slice(0, 2).map((task) => (
                            <span
                              key={task.id}
                              className={cn(
                                "mb-0.5 w-full truncate rounded px-1.5 py-px text-[10px] leading-tight",
                                CHIP_COLOR[task.priority],
                                task.completed && "opacity-50 line-through"
                              )}
                            >
                              {task.title}
                            </span>
                          ))}

                          {dayTasks.length > 2 && (
                            <span className="mt-0.5 text-[10px] text-muted-foreground px-1">
                              +{dayTasks.length - 2} more
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Day detail ───────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">

              {/* Day header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div>
                  <h2 className="text-base font-semibold leading-tight">
                    {isToday(selectedDay)
                      ? "Today"
                      : format(selectedDay, "EEEE")}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(selectedDay, "MMMM d, yyyy")}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddForm((v) => !v)}
                  variant={showAddForm ? "secondary" : "default"}
                >
                  <Plus size={14} className="mr-1" />
                  Add task
                </Button>
              </div>

              <div className="flex flex-col flex-1 overflow-y-auto px-6 py-4 gap-3">
                {/* Add task form */}
                {showAddForm && (
                  <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 shrink-0">
                    <Input
                      autoFocus
                      placeholder="Task title…"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddTask()
                        if (e.key === "Escape") setShowAddForm(false)
                      }}
                    />
                    <div className="flex items-center gap-2 flex-wrap">
                      <Input
                        type="time"
                        value={newTime}
                        onChange={(e) => setNewTime(e.target.value)}
                        className="h-8 w-28 text-sm"
                      />
                      <div className="flex gap-1">
                        {(["low", "medium", "high"] as const).map((p) => (
                          <button
                            key={p}
                            onClick={() => setNewPriority(p as TaskPriority)}
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-xs border capitalize transition-colors",
                              PRIORITY_COLOR[p],
                              newPriority === p
                                ? "ring-1 ring-offset-1 ring-current"
                                : "opacity-60"
                            )}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div className="ml-auto flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setShowAddForm(false)}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={handleAddTask}>
                          Add
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Task list */}
                {tasksForSelectedDay.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
                      <CalendarDays size={22} className="opacity-40" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-foreground/60">No tasks this day</p>
                      <p className="text-xs text-muted-foreground">
                        Click &ldquo;Add task&rdquo; to schedule something here.
                      </p>
                    </div>
                  </div>
                ) : (
                  tasksForSelectedDay.map((task) => (
                    <div
                      key={task.id}
                      className={cn(
                        "group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                        "border-border bg-card hover:bg-accent/30",
                        task.completed && "opacity-60"
                      )}
                    >
                      <button
                        onClick={() => handleToggle(task.id)}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {task.completed ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : (
                          <Circle size={18} />
                        )}
                      </button>
                      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                        <span
                          className={cn(
                            "text-sm font-medium leading-snug truncate",
                            task.completed && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border capitalize font-medium",
                              PRIORITY_COLOR[task.priority]
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", DOT_COLOR[task.priority])}
                            />
                            {task.priority}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}