"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"

export type CalendarEvent = {
  id: string
  title: string
  date: string        // yyyy-MM-dd
  time?: string
  priority: "low" | "medium" | "high"
  remind: boolean
  assigneeNames: string[]  // empty = everyone
  createdAt: string
}

type CalendarContextValue = {
  events: CalendarEvent[]
  addEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => void
  updateEvent: (id: string, updates: Partial<CalendarEvent>) => void
  getEventsForDate: (dateStr: string) => CalendarEvent[]
  getTodayReminders: () => CalendarEvent[]
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

const STORAGE_KEY = "wms:calendar-events"

function load(): CalendarEvent[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
  } catch {
    return []
  }
}

function save(events: CalendarEvent[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
}

export function CalendarProvider({ children }: { children: React.ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])

  useEffect(() => {
    setEvents(load())
  }, [])

  function persist(next: CalendarEvent[]) {
    setEvents(next)
    save(next)
  }

  const addEvent = useCallback((event: CalendarEvent) => {
    setEvents((prev) => {
      const next = [...prev, event]
      save(next)
      return next
    })
  }, [])

  const deleteEvent = useCallback((id: string) => {
    setEvents((prev) => {
      const next = prev.filter((e) => e.id !== id)
      save(next)
      return next
    })
  }, [])

  const updateEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    setEvents((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
      save(next)
      return next
    })
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
      value={{ events, addEvent, deleteEvent, updateEvent, getEventsForDate, getTodayReminders }}
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