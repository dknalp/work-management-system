"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { subDays, format } from "date-fns"
import { useTasks } from "@/contexts/task-context"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

const chartConfig = {
  created: {
    label: "Created",
    color: "var(--chart-2)",
  },
  completed: {
    label: "Completed",
    color: "var(--chart-1)",
  },
}

export function TaskOverviewChart() {
  const { tasks } = useTasks()

  const data = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
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
  }, [tasks])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Task Activity</CardTitle>
        <CardDescription>Created vs completed — last 7 days</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-created)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-created)" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-completed)" stopOpacity={0.25} />
                <stop offset="95%" stopColor="var(--color-completed)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="hsl(var(--border) / 0.4)"
            />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              width={24}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="created"
              type="monotone"
              fill="url(#fillCreated)"
              stroke="var(--color-created)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Area
              dataKey="completed"
              type="monotone"
              fill="url(#fillCompleted)"
              stroke="var(--color-completed)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}