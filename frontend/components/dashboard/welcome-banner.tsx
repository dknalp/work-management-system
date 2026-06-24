"use client"

import { useEffect, useSyncExternalStore, useState } from "react"
import { CalendarDaysIcon, SparklesIcon } from "lucide-react"

function getGreeting(hour: number): string {
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })
}

const subscribe = () => () => {}

export function WelcomeBanner() {
  const mounted = useSyncExternalStore(subscribe, () => true, () => false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  if (!mounted) return null

  const greeting = getGreeting(now.getHours())
  const dateStr = formatDate(now)

  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <SparklesIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {greeting}
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Welcome back, Alex
        </h1>
              </div>
      <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 shadow-xs">
        <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">{dateStr}</span>
      </div>
    </div>
  )
}
