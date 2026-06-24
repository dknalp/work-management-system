import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ClipboardListIcon, PlusIcon, ArrowRightIcon } from "lucide-react"

export function UpcomingTasks() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">
            Upcoming Tasks
          </CardTitle>
                  </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          View all
          <ArrowRightIcon className="size-3" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-12">
        {/* Empty state */}
        <div className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40">
          <ClipboardListIcon className="size-7 text-muted-foreground/60" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">
            No upcoming tasks
          </p>
                  </div>
        <Button size="sm" className="mt-2 gap-2">
          <PlusIcon className="size-4" />
          Add Task
        </Button>
      </CardContent>
    </Card>
  )
}
