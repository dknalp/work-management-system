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
  Clock,
  CalendarDays,
  Bell,
  BellOff,
  Users,
  X,
} from "lucide-react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { useCalendar, CalendarEvent } from "@/contexts/calendar-context"
import { useTeam } from "@/contexts/team-context"
import { toast } from "sonner"
import { usePermissions } from "@/contexts/permissions-context"
import { AccessDenied } from "@/components/auth/access-denied"

type Priority = "low" | "medium" | "high"

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30",
  high: "bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30",
}

const CHIP_COLOR: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  high: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
}

const DOT_COLOR: Record<string, string> = {
  low: "bg-emerald-500",
  medium: "bg-amber-500",
  high: "bg-rose-500",
}

const PRIORITY_LABEL: Record<string, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
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

const DAY_HEADERS = ["Pz", "Pt", "Sa", "Ça", "Pe", "Cu", "Ct"]

export default function CalendarPage() {
  const { permissions, loading: permLoading } = usePermissions()
  const canView = permissions.includes("calendar:view")
  const canEdit = permissions.includes("calendar:edit")
  const { events, addEvent, deleteEvent, getEventsForDate } = useCalendar()
  const { members } = useTeam()

  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())
  const [showAddForm, setShowAddForm] = useState(false)

  // Form state
  const [newTitle, setNewTitle] = useState("")
  const [newPriority, setNewPriority] = useState<Priority>("medium")
  const [newTime, setNewTime] = useState("")
  const [newRemind, setNewRemind] = useState(false)
  const [newAssignAll, setNewAssignAll] = useState(true)
  const [newAssignees, setNewAssignees] = useState<string[]>([])

  const weeks = useMemo(
    () => buildCalendarWeeks(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  )

  const selectedDateStr = format(selectedDay, "yyyy-MM-dd")
  const eventsForSelectedDay = getEventsForDate(selectedDateStr)

  const monthEventCount = useMemo(
    () =>
      events.filter((e) => {
        const d = parseISO(e.date)
        return d >= startOfMonth(currentMonth) && d <= endOfMonth(currentMonth)
      }).length,
    [events, currentMonth]
  )

  function resetForm() {
    setNewTitle("")
    setNewPriority("medium")
    setNewTime("")
    setNewRemind(false)
    setNewAssignAll(true)
    setNewAssignees([])
    setShowAddForm(false)
  }

  function handleAddEvent() {
    if (!newTitle.trim()) return
    const event: CalendarEvent = {
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      date: selectedDateStr,
      time: newTime || undefined,
      priority: newPriority,
      remind: newRemind,
      assigneeNames: newAssignAll ? [] : newAssignees,
      createdAt: new Date().toISOString(),
    }
    addEvent(event)
    toast.success("Olay takvime eklendi")
    resetForm()
  }

  function toggleAssignee(name: string) {
    setNewAssignees((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    )
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
          {permLoading ? null : !canView ? (
            <AccessDenied />
          ) : (
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
                    <span>{monthEventCount} olay</span>
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
                        const dayEvents = getEventsForDate(dayStr)
                        const isSelected = isSameDay(date, selectedDay)
                        const isTodayDate = isToday(date)
                        const hasReminder = dayEvents.some((e) => e.remind)

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

                            {hasReminder && (
                              <span className="absolute top-1 right-1">
                                <Bell className="size-2.5 text-amber-500" />
                              </span>
                            )}

                            {dayEvents.slice(0, 2).map((event) => (
                              <span
                                key={event.id}
                                className={cn(
                                  "mb-0.5 w-full truncate rounded px-1.5 py-px text-[10px] leading-tight",
                                  CHIP_COLOR[event.priority]
                                )}
                              >
                                {event.title}
                              </span>
                            ))}

                            {dayEvents.length > 2 && (
                              <span className="mt-0.5 text-[10px] text-muted-foreground px-1">
                                +{dayEvents.length - 2} daha
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
                      {isToday(selectedDay) ? "Bugün" : format(selectedDay, "EEEE")}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(selectedDay, "MMMM d, yyyy")}
                    </p>
                  </div>
                  {canEdit && (
                    <Button
                      size="sm"
                      onClick={() => setShowAddForm((v) => !v)}
                      variant={showAddForm ? "secondary" : "default"}
                    >
                      <Plus size={14} className="mr-1" />
                      Olay Ekle
                    </Button>
                  )}
                </div>

                <div className="flex flex-col flex-1 overflow-y-auto px-6 py-4 gap-3">
                  {/* Add event form */}
                  {showAddForm && canEdit && (
                    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 shrink-0">
                      <Input
                        autoFocus
                        placeholder="Olay başlığı…"
                        value={newTitle}
                        onChange={(e) => setNewTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleAddEvent()
                          if (e.key === "Escape") resetForm()
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
                              type="button"
                              onClick={() => setNewPriority(p)}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs border capitalize transition-colors",
                                PRIORITY_COLOR[p],
                                newPriority === p
                                  ? "ring-1 ring-offset-1 ring-current"
                                  : "opacity-60"
                              )}
                            >
                              {PRIORITY_LABEL[p]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Remind toggle */}
                      <button
                        type="button"
                        onClick={() => setNewRemind((v) => !v)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-sm border transition-colors w-full",
                          newRemind
                            ? "bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400"
                            : "border-border text-muted-foreground hover:bg-muted/40"
                        )}
                      >
                        {newRemind ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
                        <span>{newRemind ? "Hatırlatma açık" : "Hatırlat"}</span>
                        {newRemind && (
                          <span className="ml-auto text-xs opacity-70">O gün herkes bildirilir</span>
                        )}
                      </button>

                      {/* Assignee picker — only when remind is on */}
                      {newRemind && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Users className="size-3.5 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground">Kimler bildirilsin?</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() => { setNewAssignAll(true); setNewAssignees([]) }}
                              className={cn(
                                "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                                newAssignAll
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-muted-foreground hover:bg-muted/40"
                              )}
                            >
                              Herkes
                            </button>
                            {members.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => {
                                  setNewAssignAll(false)
                                  toggleAssignee(m.name)
                                }}
                                className={cn(
                                  "rounded-full px-2.5 py-0.5 text-xs border transition-colors",
                                  !newAssignAll && newAssignees.includes(m.name)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "border-border text-muted-foreground hover:bg-muted/40"
                                )}
                              >
                                {m.name.split(" ")[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={resetForm}>
                          İptal
                        </Button>
                        <Button size="sm" onClick={handleAddEvent} disabled={!newTitle.trim()}>
                          Ekle
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Event list */}
                  {eventsForSelectedDay.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground py-16">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted/60">
                        <CalendarDays size={22} className="opacity-40" />
                      </div>
                      <div className="text-center space-y-1">
                        <p className="text-sm font-medium text-foreground/60">Bu gün olay yok</p>
                        <p className="text-xs text-muted-foreground">
                          &ldquo;Olay Ekle&rdquo;ye tıklayarak planlayın.
                        </p>
                      </div>
                    </div>
                  ) : (
                    eventsForSelectedDay.map((event) => (
                      <div
                        key={event.id}
                        className={cn(
                          "group flex items-start gap-3 rounded-xl border px-4 py-3 transition-colors",
                          "border-border bg-card hover:bg-accent/30"
                        )}
                      >
                        <div className="mt-0.5 shrink-0">
                          <div
                            className={cn(
                              "size-2 rounded-full mt-1.5",
                              DOT_COLOR[event.priority]
                            )}
                          />
                        </div>
                        <div className="flex flex-1 flex-col gap-1 min-w-0">
                          <span className="text-sm font-medium leading-snug truncate">
                            {event.title}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] border capitalize font-medium",
                                PRIORITY_COLOR[event.priority]
                              )}
                            >
                              {PRIORITY_LABEL[event.priority]}
                            </span>
                            {event.time && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Clock className="size-2.5" />
                                {event.time}
                              </span>
                            )}
                            {event.remind && (
                              <span className="flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
                                <Bell className="size-2.5" />
                                {event.assigneeNames.length === 0
                                  ? "Herkes hatırlatılıyor"
                                  : `${event.assigneeNames.join(", ")} hatırlatılıyor`}
                              </span>
                            )}
                          </div>
                        </div>
                        {canEdit && (
                          <button
                            onClick={() => {
                              deleteEvent(event.id)
                              toast.success("Olay silindi")
                            }}
                            className="mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}