"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { apiClient } from "@/lib/api"

export type CalendarEvent = {
  id: string
  title: string
  date: string        // yyyy-MM-dd
  time?: string
  priority: "low" | "medium" | "high"
  remind: boolean
  assigneeNames: string[]
  createdAt: string
}

type ApiEvent = {
  id: string
  title: string
  date: string
  time?: string | null
  priority: string
  remind: boolean
  assignee_names?: string[] | null
  created_at: string
}

function fromApi(e: ApiEvent): CalendarEvent {
  return {
    id: e.id,
    title: e.title,
    date: e.date,
    time: e.time ?? undefined,
    priority: e.priority as CalendarEvent["priority"],
    remind: e.remind,
    assigneeNames: e.assignee_names ?? [],
    createdAt: e.created_at,
  }
}

type CalendarContextValue = {
  events: CalendarEvent[]
  loading: boolean
  addEvent: (event: Omit<CalendarEvent, "createdAt">) => Promise<void>
  deleteEvent: (id: string) => Promise<void>
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>
  getEventsForDate: (dateStr: string) => CalendarEvent[]
  getTodayReminders: () => CalendarEvent[]
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const data = await apiClient<ApiEvent[]>("/calendar")
      setEvents(data.map(fromApi))
    } catch {
      // keep previous state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  const addEvent = useCallback(async (event: Omit<CalendarEvent, "createdAt">) => {
    const created = await apiClient<ApiEvent>("/calendar", {
      method: "POST",
      body: JSON.stringify({
        id: event.id,
        title: event.title,
        date: event.date,
        time: event.time ?? null,
        priority: event.priority,
        remind: event.remind,
        assignee_names: event.assigneeNames,
      }),
    })
    setEvents((prev) => [...prev, fromApi(created)])
  }, [])

  const deleteEvent = useCallback(async (id: string) => {
    await apiClient(`/calendar/${id}`, { method: "DELETE" })
    setEvents((prev) => prev.filter((e) => e.id !== id))
  }, [])

  const updateEvent = useCallback(async (id: string, updates: Partial<CalendarEvent>) => {
    const body: Record<string, unknown> = {}
    if (updates.title !== undefined) body.title = updates.title
    if (updates.date !== undefined) body.date = updates.date
    if (updates.time !== undefined) body.time = updates.time ?? null
    if (updates.priority !== undefined) body.priority = updates.priority
    if (updates.remind !== undefined) body.remind = updates.remind
    if (updates.assigneeNames !== undefined) body.assignee_names = updates.assigneeNames

    const updated = await apiClient<ApiEvent>(`/calendar/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    })
    setEvents((prev) => prev.map((e) => (e.id === id ? fromApi(updated) : e)))
  }, [])

  const getEventsForDate = useCallback(
    (dateStr: string) => events.filter((e) => e.date === dateStr),
    [events]
  )

  const getTodayReminders = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10)
    return events.filter((e) => e.date === today && e.remind)
  }, [events])

  return (
    <CalendarContext.Provider
      value={{ events, loading, addEvent, deleteEvent, updateEvent, getEventsForDate, getTodayReminders }}
    >
      {children}
    </CalendarContext.Provider>
  )
}

export function useCalendar() {
  const ctx = useContext(CalendarContext)
  if (!ctx) throw new Error("useCalendar must be used inside CalendarProvider")
  return ctx
}
