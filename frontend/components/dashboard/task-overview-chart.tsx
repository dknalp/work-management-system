"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { useTasks } from "@/contexts/task-context"
import { useMemo } from "react"
import { subDays, format, isAfter, startOfDay } from "date-fns"

export function TaskOverviewChart() {
  const { tasks } = useTasks()

  const data = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(new Date(), 6 - i)
      const key = format(date, "yyyy-MM-dd")
      const label = format(date, "EEE")
      const created = tasks.filter(
        (t) => t.createdAt && format(new Date(t.createdAt), "yyyy-MM-dd") === key
      ).length
      const completed = tasks.filter(
        (t) =>
          t.status === "done" &&
          t.createdAt &&
          format(new Date(t.createdAt), "yyyy-MM-dd") === key
      ).length
      return { label, created, completed }
    })
    return days
  }, [tasks])

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Task Activity (Last 7 Days)</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Created vs completed tasks per day</p>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            width={24}
          />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: 12,
            }}
            cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
          />
          <Bar dataKey="created" name="Created" fill="hsl(var(--primary) / 0.5)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="completed" name="Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary/50" /> Created
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary" /> Completed
        </span>
      </div>
    </div>
  )
}