"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { useTasks } from "@/contexts/task-context"
import { useMemo } from "react"

export function TeamWorkloadChart() {
  const { tasks } = useTasks()

  const data = useMemo(() => {
    const assigneeMap: Record<string, { todo: number; "in-progress": number; done: number }> = {}
    tasks.forEach((t) => {
      const name = t.assignee || "Unassigned"
      if (!assigneeMap[name]) assigneeMap[name] = { todo: 0, "in-progress": 0, done: 0 }
      assigneeMap[name][t.status]++
    })
    return Object.entries(assigneeMap)
      .map(([name, counts]) => ({
        name: name.length > 10 ? name.split(" ")[0] : name,
        todo: counts.todo,
        inProgress: counts["in-progress"],
        done: counts.done,
        total: counts.todo + counts["in-progress"] + counts.done,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [tasks])

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold">Team Workload</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Task distribution by assignee</p>
      </div>
      {data.length === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
          No task data yet
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} layout="vertical" barGap={2} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              width={60}
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
            <Bar dataKey="todo" name="To-Do" stackId="a" fill="hsl(var(--muted-foreground) / 0.3)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="hsl(210 100% 56% / 0.7)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="done" name="Done" stackId="a" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-muted-foreground/30" />To-Do</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{background:"hsl(210 100% 56% / 0.7)"}} />In Progress</span>
        <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" />Done</span>
      </div>
    </div>
  )
}</content>