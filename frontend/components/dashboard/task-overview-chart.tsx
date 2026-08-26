"use client"

import { useEffect, useMemo, useState } from "react"
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
import { apiClient } from "@/lib/api"
import { MOCK_AUTH } from "@/contexts/auth-context"

type DailyPoint = { date: string; created: number; completed: number }

const chartConfig = {
  created: {
    label: "Oluşturulan",
    color: "var(--chart-2)",
  },
  completed: {
    label: "Tamamlanan",
    color: "var(--chart-1)",
  },
}

export function TaskOverviewChart() {
  const { tasks } = useTasks()
  const [apiData, setApiData] = useState<DailyPoint[] | null>(null)

  useEffect(() => {
    if (MOCK_AUTH) return
    apiClient<DailyPoint[]>("/api/v1/analytics/daily?days=30").then(setApiData).catch(() => {})
  }, [])

  // Mock/fallback: compute 30 days of data from local tasks (mirrors the real API window)
  const mockData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = subDays(new Date(), 29 - i)
      const key = format(date, "yyyy-MM-dd")
      const label = format(date, "EEE")
      const created = tasks.filter(
        (t) => t.createdAt && format(new Date(t.createdAt), "yyyy-MM-dd") === key
      ).length
      const completed = tasks.filter(
        (t) => t.completedAt && format(new Date(t.completedAt), "yyyy-MM-dd") === key
      ).length
      return { label, created, completed }
    })
  }, [tasks])

  const data = apiData
    ? apiData.map((p) => ({
        label: format(new Date(p.date), "EEE"),
        created: p.created,
        completed: p.completed,
      }))
    : mockData

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Görev Aktivitesi</CardTitle>
        <CardDescription>Oluşturulan - tamamlanan — son 30 gün</CardDescription>
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