"use client"

import React, { useState, useMemo } from "react"
import { DayPicker } from "react-day-picker"
import "react-day-picker/dist/style.css"
import { format, parseISO, isToday, isSameDay, startOfMonth, endOfMonth } from "date-fns"
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  Clock,
} from "lucide-react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useTasks } from "@/contexts/task-context"
import { Task, TaskPriority } from "@/components/tasks/task-types"
import { toast } from "sonner"

type CalendarTask = {
  id: string
  title: string
  date: string
  priority: "low" | "medium" | "high"
  completed: boolean
  time?: string
}

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
  high: "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30",
  urgent: "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30",
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

export default function CalendarPage() {
  const { tasks, addTask, updateTask, deleteTask } = useTasks()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<TaskPriority>("medium")
  const [newTime, setNewTime] = useState("")

  // Derive calendar tasks from TaskContext (only tasks with a dueDate)
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

  const selectedDateStr = format(selectedDay, "yyyy-MM-dd")

  const tasksForSelectedDay = calendarTasks.filter((t) => t.date === selectedDateStr)

  // Compute which dates have tasks (for dot indicators)
  const datesWithTasks = useMemo(() => {
    const set = new Set<string>()
    calendarTasks.forEach((t) => set.add(t.date))
    return set
  }, [calendarTasks])

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
          <div className="flex flex-1 flex-col lg:flex-row gap-0 overflow-hidden">
            {/* Calendar panel */}
            <div className="flex flex-col items-center p-6 lg:w-[400px] border-r border-border shrink-0">
              {/* Month nav */}
              <div className="flex w-full items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">
                  {format(currentMonth, "MMMM yyyy")}
                </h2>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={prevMonth}>
                    <ChevronLeft size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={nextMonth}>
                    <ChevronRight size={16} />
                  </Button>
                </div>
              </div>

              <DayPicker
                mode="single"
                month={currentMonth}
                selected={selectedDay}
                onSelect={(d) => d && setSelectedDay(d)}
                onMonthChange={setCurrentMonth}
                showOutsideDays
                className="w-full"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-2",
                  caption: "hidden",
                  nav: "hidden",
                  table: "w-full border-collapse",
                  head_row: "flex",
                  head_cell:
                    "text-muted-foreground w-full text-center text-xs font-medium pb-1",
                  row: "flex w-full",
                  cell: "w-full text-center relative",
                  day: cn(
                    "h-9 w-full rounded-md text-sm hover:bg-accent transition-colors",
                    "focus:outline-none focus:ring-1 focus:ring-ring"
                  ),
                  day_selected: "bg-primary text-primary-foreground hover:bg-primary",
                  day_today: "font-bold text-primary",
                  day_outside: "text-muted-foreground/50",
                  day_disabled: "text-muted-foreground/30",
                }}
                modifiers={{
                  hasTasks: Array.from(datesWithTasks).map((s) => new Date(s + "T12:00:00")),
                }}
                modifiersClassNames={{
                  hasTasks: "has-tasks",
                }}
              />

              {/* Quick stats */}
              <div className="mt-4 w-full rounded-lg border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  This month
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total tasks</span>
                  <span className="font-medium">
                    {
                      calendarTasks.filter((t) => {
                        const d = parseISO(t.date)
                        return (
                          d >= startOfMonth(currentMonth) &&
                          d <= endOfMonth(currentMonth)
                        )
                      }).length
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Completed</span>
                  <span className="font-medium text-emerald-600">
                    {
                      calendarTasks.filter((t) => {
                        const d = parseISO(t.date)
                        return (
                          t.completed &&
                          d >= startOfMonth(currentMonth) &&
                          d <= endOfMonth(currentMonth)
                        )
                      }).length
                    }
                  </span>
                </div>
              </div>
            </div>

            {/* Day detail panel */}
            <div className="flex flex-1 flex-col overflow-hidden p-6">
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">
                    {isToday(selectedDay) ? "Today" : format(selectedDay, "EEEE")}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {format(selectedDay, "MMMM d, yyyy")}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddForm((v) => !v)}
                  variant={showAddForm ? "secondary" : "default"}
                >
                  <Plus size={15} className="mr-1" />
                  Add task
                </Button>
              </div>

              {/* Add task form */}
              {showAddForm && (
                <div className="mb-4 rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
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
                  <div className="flex items-center gap-2">
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
                            newPriority === p ? "ring-1 ring-offset-1 ring-current" : "opacity-60"
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
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
                  <div className="rounded-full bg-muted p-4">
                    <Clock size={28} className="opacity-50" />
                  </div>
                  <p className="text-sm">No tasks scheduled for this day.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAddForm(true)}
                  >
                    <Plus size={14} className="mr-1" /> Schedule a task
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-2 overflow-y-auto">
                  {tasksForSelectedDay.map((task) => (
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
                          {task.time && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock size={11} />
                              {task.time}
                            </span>
                          )}
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border capitalize font-medium",
                              PRIORITY_COLOR[task.priority]
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                DOT_COLOR[task.priority]
                              )}
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
                  ))}
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}