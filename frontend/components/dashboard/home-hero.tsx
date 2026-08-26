"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CheckCircle2, Clock, AlertTriangle, ListTodo } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTasks } from "@/contexts/task-context"

function getGreeting(hour: number) {
  if (hour < 12) return "Günaydın"
  if (hour < 18) return "İyi günler"
  return "İyi akşamlar"
}


export function HomeHero() {
  const { user } = useAuth()
  const { tasks } = useTasks()
  const [time, setTime] = useState<string | null>(null)
  const [dateStr, setDateStr] = useState<string>("")
  const [hour, setHour] = useState(0)

  useEffect(() => {
    function tick() {
      const now = new Date()
      setTime(format(now, "HH:mm:ss"))
      setDateStr(format(now, "EEEE, d MMMM yyyy", { locale: tr }))
      setHour(now.getHours())
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  const firstName = user?.name?.split(" ")[0] ?? "Kullanıcı"
  const today = time ? format(new Date(), "yyyy-MM-dd") : ""

  const todaysTasks = tasks.filter((t) => t.due_date?.startsWith(today))
  const completedToday = todaysTasks.filter((t) => t.status === "done").length
  const overdueCount = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.due_date &&
      t.due_date < today
  ).length

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/60 ring-1 ring-foreground/10 backdrop-blur-sm p-6 md:p-8">
      {/* Subtle gradient overlay */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-amber-500/5 rounded-2xl" />

      <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        {/* Left: Greeting */}
        <div className="flex-1">
          <h1 suppressHydrationWarning className="text-2xl font-semibold tracking-tight">
            {getGreeting(hour)}, {firstName} 👋
          </h1>
          {/* Today's quick stats */}
          <div className="mt-5 flex flex-wrap gap-2">
            <div className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium ring-1 ring-foreground/10">
              <ListTodo className="size-3.5 text-blue-500" />
              <span suppressHydrationWarning>{todaysTasks.length} görev bugün</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs font-medium ring-1 ring-foreground/10">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span suppressHydrationWarning>{completedToday} tamamlandı</span>
            </div>
            {/* Always render the overdue badge container so the DOM structure
                matches between server (overdueCount=0) and client. Hiding via
                visibility/opacity avoids a structural HTML mismatch (#418). */}
            <div
              suppressHydrationWarning
              className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 ring-1 ring-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-800/40"
              style={{ display: overdueCount > 0 ? "flex" : "none" }}
            >
              <AlertTriangle className="size-3.5" />
              <span suppressHydrationWarning>{overdueCount} gecikmiş</span>
            </div>
          </div>
        </div>

        {/* Right: Clock + Date */}
        <div className="flex flex-col items-start md:items-end gap-1 shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="size-4 text-muted-foreground" />
            <span suppressHydrationWarning className="font-mono text-3xl font-bold tabular-nums tracking-tight">
              {time ?? "──:──:──"}
            </span>
          </div>
          <p suppressHydrationWarning className="text-sm text-muted-foreground capitalize">
            {dateStr || "─────────────────"}
          </p>
        </div>
      </div>
    </div>
  )
}