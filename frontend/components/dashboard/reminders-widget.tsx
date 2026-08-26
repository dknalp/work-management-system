"use client"

/**
 * RemindersWidget
 *
 * Displays today's calendar events/reminders in a card. Links to /calendar.
 *
 * Must only be rendered inside a <ClientOnly> boundary — it reads from the
 * calendar context which is always empty on the server.
 */

import { Bell, CalendarClock, Clock } from "lucide-react"
import { useCalendar } from "@/contexts/calendar-context"
import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

export function RemindersWidget() {
  const { getTodayReminders } = useCalendar()
  const todayEvents = getTodayReminders()

  return (
    <div className="flex flex-col rounded-2xl bg-card ring-1 ring-foreground/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Hatırlatıcılar</h2>
          </div>
          <div className="flex items-center gap-2">
            {todayEvents.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                {todayEvents.length}
              </span>
            )}
            <Link
              href="/calendar"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowRightIcon className="size-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-border/40">
        {todayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <Bell className="size-7 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Bugün hatırlatıcı yok</p>
            <Link
              href="/calendar"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
            >
              Takvime git
            </Link>
          </div>
        ) : (
          todayEvents.map((event) => (
            <div key={event.id} className="flex items-center gap-3 py-3">
              <div className="shrink-0 flex items-center justify-center size-8 rounded-lg bg-amber-50 dark:bg-amber-950/30">
                <CalendarClock className="size-4 text-amber-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">{event.title}</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {event.time && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="size-2.5" />
                      {event.time}
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {event.assigneeNames.length === 0
                      ? "Herkes"
                      : event.assigneeNames.join(", ")}
                  </span>
                </div>
              </div>
              <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                Bugün
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}