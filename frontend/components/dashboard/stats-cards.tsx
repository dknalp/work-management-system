"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  ClipboardListIcon,
  UsersIcon,
  TrendingUpIcon,
  ArrowUpIcon,
  AlertCircleIcon,
  CheckCircleIcon,
} from "lucide-react"
import { useTasks } from "@/contexts/task-context"
import { useTeam } from "@/contexts/team-context"
import { useMemo } from "react"

export function StatsCards() {
  const { tasks } = useTasks()
  const { members } = useTeam()

  const computed = useMemo(() => {
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const totalTasks = tasks.length
    const doneTasks = tasks.filter((t) => t.status === "done").length
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
    const overdueTasks = tasks.filter(
      (t) => t.status !== "done" && t.dueDate && t.dueDate < todayStr
    ).length
    const dueTodayTasks = tasks.filter(
      (t) => t.status !== "done" && t.dueDate === todayStr
    ).length
    const activeMembers = members.filter((m) => m.status === "active").length
    return { totalTasks, doneTasks, completionRate, overdueTasks, dueTodayTasks, activeMembers }
  }, [tasks, members])

  const cards = [
    {
      label: "Total Tasks",
      value: `${computed.totalTasks}`,
      icon: ClipboardListIcon,
      foot: (
        <>
          <CheckCircleIcon className="size-3 text-emerald-500" />
          {computed.doneTasks} completed
        </>
      ),
    },
    {
      label: "Due Today",
      value: `${computed.dueTodayTasks}`,
      icon: ClipboardListIcon,
      foot: (
        <>
          <AlertCircleIcon className="size-3 text-destructive" />
          {computed.overdueTasks} overdue
        </>
      ),
    },
    {
      label: "Team Members",
      value: `${members.length}`,
      icon: UsersIcon,
      foot: (
        <>
          <ArrowUpIcon className="size-3" />
          {computed.activeMembers} active now
        </>
      ),
    },
    {
      label: "Completion Rate",
      value: `${computed.completionRate}%`,
      icon: TrendingUpIcon,
      foot: (
        <>
          <ArrowUpIcon className="size-3" />
          {computed.doneTasks} of {computed.totalTasks} tasks done
        </>
      ),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((stat) => {
        const Icon = stat.icon
        return (
          <Card
            key={stat.label}
            className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 dark:hover:shadow-primary/10"
          >
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardDescription className="text-xs font-medium tracking-wider uppercase">
                  {stat.label}
                </CardDescription>
                <div className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors duration-150 group-hover:bg-primary/10 group-hover:text-primary">
                  <Icon className="size-4" />
                </div>
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight tabular-nums">
                {stat.value}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                {stat.foot}
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}