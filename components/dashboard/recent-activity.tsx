import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ActivityIcon, ArrowRightIcon, ZapIcon } from "lucide-react"

export function RecentActivity() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            Recent Activity
          </CardTitle>
          <CardDescription className="text-xs">
            Team actions and project updates
          </CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          See all
          <ArrowRightIcon className="size-3" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
        {/* Empty state */}
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
          <ActivityIcon className="size-7 text-muted-foreground/60" />
          {/* Pulse dot */}
          <span className="absolute -top-1 -right-1 flex size-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75" />
            <span className="relative inline-flex size-3 rounded-full bg-primary/60" />
          </span>
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">
            No recent activity
          </p>
          <p className="max-w-[220px] text-xs text-muted-foreground">
            Actions taken by you or your team will appear here in real time.
          </p>
        </div>
        <Button size="sm" variant="outline" className="mt-2 gap-2">
          <ZapIcon className="size-4" />
          Invite teammates
        </Button>
      </CardContent>
    </Card>
  )
}
