"use client"

import { useMemo, useState } from "react"
import { formatDistanceToNow, parseISO } from "date-fns"
import {
  CheckCircle2,
  PlusCircle,
  Trash2,
  RefreshCw,
  ArrowRightLeft,
  Pencil,
  BellIcon,
  CheckCheckIcon,
} from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTasks, ActivityType, ActivityEntry } from "@/contexts/task-context"
import { cn } from "@/lib/utils"

const ACTIVITY_META: Record<
  ActivityType,
  { label: (title: string, detail?: string) => string; icon: React.ElementType; color: string }
> = {
  task_created: {
    label: (t) => `Created "${t}"`,
    icon: PlusCircle,
    color: "text-blue-500",
  },
  task_completed: {
    label: (t) => `Completed "${t}"`,
    icon: CheckCircle2,
    color: "text-emerald-500",
  },
  task_reopened: {
    label: (t) => `Reopened "${t}"`,
    icon: RefreshCw,
    color: "text-amber-500",
  },
  task_status_changed: {
    label: (t, d) => `Moved "${t}"${d ? ` (${d})` : ""}`,
    icon: ArrowRightLeft,
    color: "text-violet-500",
  },
  task_deleted: {
    label: (t) => `Deleted "${t}"`,
    icon: Trash2,
    color: "text-rose-500",
  },
  task_updated: {
    label: (t) => `Updated "${t}"`,
    icon: Pencil,
    color: "text-muted-foreground",
  },
}

export function NotificationsPopover() {
  const { activity } = useTasks()
  const [lastSeenCount, setLastSeenCount] = useState(0)
  const [open, setOpen] = useState(false)

  const unreadCount = Math.max(0, activity.length - lastSeenCount)

  const visible: ActivityEntry[] = useMemo(() => activity.slice(0, 20), [activity])

  function handleOpenChange(isOpen: boolean) {
    setOpen(isOpen)
    if (isOpen) {
      setLastSeenCount(activity.length)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
          aria-label="Notifications"
        >
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 rounded-xl shadow-xl border border-border/50"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {activity.length > 0 && (
            <button
              onClick={() => setLastSeenCount(activity.length)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <CheckCheckIcon className="size-3" />
              Mark all read
            </button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <BellIcon className="size-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">
              Task changes will appear here
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-96">
            <div className="divide-y divide-border/40">
              {visible.map((entry, idx) => {
                const meta = ACTIVITY_META[entry.type]
                const Icon = meta.icon
                const isUnread = idx < unreadCount
                return (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 transition-colors",
                      isUnread ? "bg-primary/5" : "hover:bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                        isUnread ? "bg-primary/10" : "bg-muted/40"
                      )}
                    >
                      <Icon className={cn("size-3.5", meta.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs leading-snug">
                        {meta.label(entry.taskTitle, entry.detail)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {formatDistanceToNow(parseISO(entry.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                    {isUnread && (
                      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}