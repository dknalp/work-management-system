"use client"

import * as React from "react"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  parseISO,
} from "date-fns"
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
  ClockIcon,
  Trash2Icon,
  CalendarIcon,
  XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventColor = "blue" | "green" | "red" | "purple" | "orange"

export interface CalendarEvent {
  id: string
  title: string
  date: string // ISO date string: "YYYY-MM-DD"
  startTime: string // "HH:MM"
  endTime: string // "HH:MM"
  color: EventColor
  description?: string
}

// ─── Color helpers ────────────────────────────────────────────────────────────

const colorMap: Record<
  EventColor,
  { pill: string; dot: string; badge: string; swatch: string; label: string }
> = {
  blue: {
    pill: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 hover:bg-blue-500/20",
    dot: "bg-blue-500",
    badge:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20",
    swatch: "bg-blue-500",
    label: "Blue",
  },
  green: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20",
    dot: "bg-emerald-500",
    badge:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20",
    swatch: "bg-emerald-500",
    label: "Green",
  },
  red: {
    pill: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20 hover:bg-rose-500/20",
    dot: "bg-rose-500",
    badge:
      "bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20",
    swatch: "bg-rose-500",
    label: "Red",
  },
  purple: {
    pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 hover:bg-violet-500/20",
    dot: "bg-violet-500",
    badge:
      "bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20",
    swatch: "bg-violet-500",
    label: "Purple",
  },
  orange: {
    pill: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20 hover:bg-orange-500/20",
    dot: "bg-orange-500",
    badge:
      "bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/20",
    swatch: "bg-orange-500",
    label: "Orange",
  },
}

// ─── Mock data ─────────────────────────────────────────────────────────────────
// "Today" is anchored to 2026-05-01 per the project date context.
// Events spread across April, May, and June 2026.

const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: "1",
    title: "Project Kickoff",
    date: "2026-05-01",
    startTime: "09:00",
    endTime: "10:00",
    color: "blue",
    description: "Initial team alignment meeting for Q2 product launch.",
  },
  {
    id: "2",
    title: "Design Review",
    date: "2026-05-01",
    startTime: "14:00",
    endTime: "15:30",
    color: "purple",
    description: "Review new dashboard mockups with the design team.",
  },
  {
    id: "3",
    title: "Client Call – Acme Corp",
    date: "2026-05-05",
    startTime: "11:00",
    endTime: "11:45",
    color: "green",
    description: "Quarterly business review with Acme Corp stakeholders.",
  },
  {
    id: "4",
    title: "Sprint Planning",
    date: "2026-05-06",
    startTime: "10:00",
    endTime: "12:00",
    color: "blue",
    description: "Plan and estimate stories for the upcoming two-week sprint.",
  },
  {
    id: "5",
    title: "API Integration Deadline",
    date: "2026-05-08",
    startTime: "17:00",
    endTime: "17:30",
    color: "red",
    description: "Final deadline for third-party payment API integration.",
  },
  {
    id: "6",
    title: "Marketing Sync",
    date: "2026-05-12",
    startTime: "13:00",
    endTime: "13:30",
    color: "orange",
    description: "Weekly sync with the marketing team on campaign progress.",
  },
  {
    id: "7",
    title: "User Research Session",
    date: "2026-05-14",
    startTime: "15:00",
    endTime: "16:30",
    color: "purple",
    description: "Moderated usability testing with 5 selected users.",
  },
  {
    id: "8",
    title: "All-Hands Meeting",
    date: "2026-05-15",
    startTime: "09:00",
    endTime: "10:30",
    color: "blue",
    description: "Company-wide all-hands to share Q1 results and Q2 goals.",
  },
  {
    id: "9",
    title: "Infrastructure Review",
    date: "2026-05-19",
    startTime: "11:00",
    endTime: "12:00",
    color: "orange",
    description: "Audit cloud spending and plan capacity for next quarter.",
  },
  {
    id: "10",
    title: "Product Demo",
    date: "2026-05-22",
    startTime: "14:00",
    endTime: "15:00",
    color: "green",
    description: "Live demo of v2.4 features for the executive team.",
  },
  {
    id: "11",
    title: "1:1 – Sarah",
    date: "2026-05-27",
    startTime: "10:00",
    endTime: "10:30",
    color: "purple",
    description:
      "Regular one-on-one with Sarah to discuss blockers and growth.",
  },
  {
    id: "12",
    title: "Release v2.4",
    date: "2026-05-29",
    startTime: "08:00",
    endTime: "09:00",
    color: "red",
    description: "Production release of version 2.4. Coordinate with DevOps.",
  },
  {
    id: "13",
    title: "Retrospective",
    date: "2026-05-29",
    startTime: "15:00",
    endTime: "16:00",
    color: "blue",
    description: "Sprint retrospective — what went well, what to improve.",
  },
  {
    id: "14",
    title: "Partner Onboarding",
    date: "2026-06-02",
    startTime: "09:30",
    endTime: "11:00",
    color: "green",
    description: "Onboard new integration partner: TechFlow Inc.",
  },
  {
    id: "15",
    title: "Q2 Strategy Session",
    date: "2026-04-28",
    startTime: "13:00",
    endTime: "15:00",
    color: "orange",
    description:
      "Leadership strategy session for Q2 objectives and key results.",
  },
]

// ─── Form defaults ─────────────────────────────────────────────────────────────

const DEFAULT_FORM = {
  title: "",
  date: "",
  startTime: "09:00",
  endTime: "10:00",
  color: "blue" as EventColor,
  description: "",
}

// ─── Day Detail Panel ─────────────────────────────────────────────────────────

interface DayPanelProps {
  date: Date | null
  events: CalendarEvent[]
  onClose: () => void
  onDelete: (id: string) => void
  onAddEvent: (date: Date) => void
}

function DayPanel({
  date,
  events,
  onClose,
  onDelete,
  onAddEvent,
}: DayPanelProps) {
  if (!date) return null

  const dayEvents = events.filter((e) => isSameDay(parseISO(e.date), date))

  return (
    <div className="flex w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-4 py-3.5">
        <div>
          <p className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            {format(date, "EEEE")}
          </p>
          <p className="mt-0.5 text-xl leading-none font-bold">
            {format(date, "d")}
            <span className="ml-1.5 text-sm font-medium text-muted-foreground">
              {format(date, "MMM yyyy")}
            </span>
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close panel"
        >
          <XIcon className="size-4" />
        </button>
      </div>

      {/* Event count badge */}
      {dayEvents.length > 0 && (
        <div className="px-4 pt-3 pb-0">
          <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">
            {dayEvents.length} event{dayEvents.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}

      {/* Event list */}
      <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto p-4">
        {dayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
            <div className="flex size-10 items-center justify-center rounded-full bg-muted">
              <CalendarIcon className="size-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No events</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Click below to add one.
              </p>
            </div>
          </div>
        ) : (
          dayEvents.map((event) => {
            const c = colorMap[event.color]
            return (
              <div
                key={event.id}
                className={cn(
                  "group rounded-xl border p-3 transition-shadow hover:shadow-sm",
                  c.badge
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "mt-px size-2 shrink-0 rounded-full",
                        c.dot
                      )}
                    />
                    <p className="truncate text-sm leading-snug font-semibold">
                      {event.title}
                    </p>
                  </div>
                  <button
                    onClick={() => onDelete(event.id)}
                    className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive"
                    title="Delete event"
                  >
                    <Trash2Icon className="size-3.5" />
                  </button>
                </div>
                <div className="mt-1.5 ml-4 flex items-center gap-1.5">
                  <ClockIcon className="size-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {event.startTime} – {event.endTime}
                  </span>
                </div>
                {event.description && (
                  <p className="mt-1.5 ml-4 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {event.description}
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Add button */}
      <div className="border-t border-border p-4">
        <Button
          size="sm"
          className="w-full gap-2"
          onClick={() => onAddEvent(date)}
        >
          <PlusIcon className="size-3.5" />
          Add Event
        </Button>
      </div>
    </div>
  )
}

// ─── Add Event Dialog ─────────────────────────────────────────────────────────

interface AddEventDialogProps {
  open: boolean
  initialDate: string
  onClose: () => void
  onSave: (event: Omit<CalendarEvent, "id">) => void
}

function AddEventDialog({
  open,
  initialDate,
  onClose,
  onSave,
}: AddEventDialogProps) {
  const [form, setForm] = React.useState({ ...DEFAULT_FORM, date: initialDate })

  React.useEffect(() => {
    if (open) {
      setForm((prev) => ({ ...prev, date: initialDate }))
    }
  }, [initialDate, open])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.date) return
    onSave({
      title: form.title.trim(),
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
      color: form.color,
      description: form.description.trim(),
    })
    setForm({ ...DEFAULT_FORM, date: "" })
  }

  function set(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="size-4" />
            New Event
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ev-title"
              placeholder="e.g. Team standup"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              required
              autoFocus
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="ev-date"
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
              required
            />
          </div>

          {/* Start / End */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-start">Start time</Label>
              <Input
                id="ev-start"
                type="time"
                value={form.startTime}
                onChange={(e) => set("startTime", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-end">End time</Label>
              <Input
                id="ev-end"
                type="time"
                value={form.endTime}
                onChange={(e) => set("endTime", e.target.value)}
              />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap items-center gap-2.5">
              {(Object.keys(colorMap) as EventColor[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  className={cn(
                    "size-7 rounded-full ring-offset-background transition-all",
                    colorMap[c].swatch,
                    form.color === c
                      ? "scale-110 ring-2 ring-foreground/50 ring-offset-2"
                      : "opacity-70 hover:scale-105 hover:opacity-100"
                  )}
                  title={colorMap[c].label}
                />
              ))}
              <span className="ml-1 text-xs text-muted-foreground">
                {colorMap[form.color as EventColor].label}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Description</Label>
            <Textarea
              id="ev-desc"
              placeholder="Optional notes..."
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              className="min-h-[72px] resize-none text-sm"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={!form.title.trim() || !form.date}>
              Save Event
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main CalendarGrid ────────────────────────────────────────────────────────

// "Today" is pinned to the project date: May 1, 2026
const PROJECT_TODAY = new Date(2026, 4, 1)

export function CalendarGrid() {
  const [currentMonth, setCurrentMonth] = React.useState(
    () => new Date(2026, 4, 1)
  )
  const [events, setEvents] = React.useState<CalendarEvent[]>(INITIAL_EVENTS)
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(null)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [dialogDate, setDialogDate] = React.useState("")

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth))
    const end = endOfWeek(endOfMonth(currentMonth))
    return eachDayOfInterval({ start, end })
  }, [currentMonth])

  const nextMonth = () => setCurrentMonth((m) => addMonths(m, 1))
  const prevMonth = () => setCurrentMonth((m) => subMonths(m, 1))
  const goToToday = () => {
    setCurrentMonth(new Date(2026, 4, 1))
    setSelectedDay(PROJECT_TODAY)
  }

  function openAddDialog(date: Date) {
    setDialogDate(format(date, "yyyy-MM-dd"))
    setDialogOpen(true)
  }

  function handleDayClick(day: Date) {
    setSelectedDay((prev) => {
      // Second click on same empty day → open add dialog
      if (prev && isSameDay(prev, day)) {
        const dayEvents = events.filter((e) => isSameDay(parseISO(e.date), day))
        if (dayEvents.length === 0) openAddDialog(day)
        return prev
      }
      return day
    })
  }

  function handleAddEvent(ev: Omit<CalendarEvent, "id">) {
    const newEvent: CalendarEvent = { ...ev, id: crypto.randomUUID() }
    setEvents((prev) => [...prev, newEvent])
    setDialogOpen(false)
    toast.success("Event created", {
      description: `"${ev.title}" added on ${format(parseISO(ev.date), "MMM d, yyyy")}.`,
    })
  }

  function handleDeleteEvent(id: string) {
    const ev = events.find((e) => e.id === id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    toast.success("Event deleted", {
      description: ev ? `"${ev.title}" has been removed.` : "Event removed.",
    })
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* ── Monthly grid ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {/* Toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border bg-muted/20 px-5 py-3.5">
          <div className="flex items-center gap-4">
            <h2 className="min-w-[150px] text-xl font-bold tracking-tight">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={prevMonth}
                aria-label="Previous month"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={goToToday}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={nextMonth}
                aria-label="Next month"
              >
                <ChevronRightIcon className="size-4" />
              </Button>
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 gap-2"
            onClick={() => {
              setDialogDate(format(selectedDay ?? PROJECT_TODAY, "yyyy-MM-dd"))
              setDialogOpen(true)
            }}
          >
            <PlusIcon className="size-3.5" />
            Add Event
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid shrink-0 grid-cols-7 border-b border-border bg-muted/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div
              key={d}
              className="py-2 text-center text-[10px] font-bold tracking-wider text-muted-foreground uppercase"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div
          className="grid min-h-0 flex-1 grid-cols-7"
          style={{
            gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(0, 1fr))`,
          }}
        >
          {days.map((day, i) => {
            const dayEvents = events.filter((e) =>
              isSameDay(parseISO(e.date), day)
            )
            const isCurrentMonth = isSameMonth(day, currentMonth)
            const isSelected = selectedDay ? isSameDay(selectedDay, day) : false
            const isTodayDay = isSameDay(day, PROJECT_TODAY)
            const visible = dayEvents.slice(0, 3)
            const overflow = dayEvents.length - 3
            const colIndex = i % 7
            const isLastCol = colIndex === 6
            const isLastRow = i >= days.length - 7

            return (
              <div
                key={day.toISOString()}
                onClick={() => handleDayClick(day)}
                className={cn(
                  "group relative flex cursor-pointer flex-col border-r border-b border-border p-1.5 transition-colors select-none",
                  isLastCol && "border-r-0",
                  isLastRow && "border-b-0",
                  !isCurrentMonth && "bg-muted/10",
                  isSelected
                    ? "bg-primary/5 ring-1 ring-primary/30 ring-inset"
                    : "hover:bg-muted/30"
                )}
              >
                {/* Day number + quick-add */}
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                      isTodayDay &&
                        "bg-primary font-bold text-primary-foreground",
                      !isTodayDay && isCurrentMonth && "text-foreground/80",
                      !isTodayDay &&
                        !isCurrentMonth &&
                        "text-muted-foreground/40"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {isCurrentMonth && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openAddDialog(day)
                      }}
                      className="flex size-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 hover:bg-muted hover:text-foreground"
                      aria-label="Add event"
                    >
                      <PlusIcon className="size-3" />
                    </button>
                  )}
                </div>

                {/* Event pills */}
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  {visible.map((ev) => {
                    const c = colorMap[ev.color]
                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedDay(day)
                        }}
                        className={cn(
                          "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px] leading-none font-medium transition-all",
                          c.pill
                        )}
                        title={`${ev.title} · ${ev.startTime}–${ev.endTime}`}
                      >
                        <span
                          className={cn("size-1 shrink-0 rounded-full", c.dot)}
                        />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    )
                  })}
                  {overflow > 0 && (
                    <span className="mt-0.5 px-1.5 text-[10px] leading-none font-medium text-muted-foreground">
                      +{overflow} more
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Day detail panel ── */}
      {selectedDay && (
        <DayPanel
          date={selectedDay}
          events={events}
          onClose={() => setSelectedDay(null)}
          onDelete={handleDeleteEvent}
          onAddEvent={openAddDialog}
        />
      )}

      {/* ── Add Event Dialog ── */}
      <AddEventDialog
        open={dialogOpen}
        initialDate={dialogDate}
        onClose={() => setDialogOpen(false)}
        onSave={handleAddEvent}
      />
    </div>
  )
}
