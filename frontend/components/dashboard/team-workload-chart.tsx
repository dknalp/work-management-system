"use client"

import { useMemo } from "react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
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
  todo: {
    label: "Yapılacak",
    color: "var(--chart-4)",
  },
  inProgress: {
    label: "Devam Ediyor",
    color: "var(--chart-2)",
  },
  done: {
    label: "Tamamlandı",
    color: "var(--chart-1)",
  },
}

export function TeamWorkloadChart() {
  const { tasks } = useTasks()

  const data = useMemo(() => {
    const assigneeMap: Record<string, { todo: number; inProgress: number; done: number }> = {}
    tasks.forEach((t) => {
      const name = t.assignee || "Unassigned"
      if (!assigneeMap[name]) assigneeMap[name] = { todo: 0, inProgress: 0, done: 0 }
      if (t.status === "todo") assigneeMap[name].todo++
      else if (t.status === "in-progress") assigneeMap[name].inProgress++
      else if (t.status === "done") assigneeMap[name].done++
    })
    return Object.entries(assigneeMap)
      .map(([name, counts]) => ({
        name: name.includes(" ") ? name.split(" ")[0] : name,
        todo: counts.todo,
        inProgress: counts.inProgress,
        done: counts.done,
        total: counts.todo + counts.inProgress + counts.done,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [tasks])

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Ekip İş Yükü</CardTitle>
        <CardDescription>Sorumluya göre görev dağılımı</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center">
            <p className="text-sm text-muted-foreground">Henüz görev verisi yok</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="h-[200px] w-full">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
              barCategoryGap="30%"
            >
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke="hsl(var(--border) / 0.4)"
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                width={52}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar
                dataKey="todo"
                stackId="a"
                fill="var(--color-todo)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="inProgress"
                stackId="a"
                fill="var(--color-inProgress)"
                radius={[0, 0, 0, 0]}
              />
              <Bar
                dataKey="done"
                stackId="a"
                fill="var(--color-done)"
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}