import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import {
  FolderKanbanIcon,
  ClipboardListIcon,
  UsersIcon,
  TrendingUpIcon,
  ArrowUpIcon,
  AlertCircleIcon,
  WifiIcon,
} from "lucide-react"

const stats = [
  {
    label: "Active Projects",
    value: "12",
    icon: FolderKanbanIcon,
    foot: (
      <>
        <ArrowUpIcon className="size-3" /> 3 new this week
      </>
    ),
  },
  {
    label: "Tasks Due Today",
    value: "5",
    icon: ClipboardListIcon,
    foot: (
      <>
        <AlertCircleIcon className="size-3 text-destructive" /> 2 overdue
      </>
    ),
  },
  {
    label: "Team Members",
    value: "8",
    icon: UsersIcon,
    foot: (
      <>
        <WifiIcon className="size-3" /> All members active
      </>
    ),
  },
  {
    label: "Completion Rate",
    value: "74%",
    icon: TrendingUpIcon,
    foot: (
      <>
        <ArrowUpIcon className="size-3" /> Up 6% this week
      </>
    ),
  },
]

export function StatsCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card
            key={stat.label}
            className="group relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 dark:hover:shadow-primary/10"
          >
            {/* Subtle top gradient accent */}
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
