"use client"

import { useState } from "react"
import { BellIcon, CheckCheckIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useTasks } from "@/contexts/task-context"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export function NotificationsPopover() {
  const { activity } = useTasks()
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [open, setOpen] = useState(false)

  const unreadCount = activity.filter((a) => !readIds.has(a.id)).length

  function markAllRead() {
    setReadIds(new Set(activity.map((a) => a.id)))
  }

  function markRead(id: string) {
    setReadIds((prev) => new Set([...prev, id]))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9">
          <BellIcon className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                {unreadCount}
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheckIcon className="size-3" />
              Mark all read
            </Button>
          )}
        </div>

        {activity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <BellIcon className="size-8 opacity-20" />
            <p className="text-sm">No notifications yet</p>
            <p className="text-xs opacity-70">Activity from tasks will appear here.</p>
          </div>
        ) : (
          <ScrollArea className="h-72">
            <div className="divide-y divide-border/40">
              {activity.slice(0, 30).map((entry) => {
                const isRead = readIds.has(entry.id)
                return (
                  <button
                    key={entry.id}
                    onClick={() => markRead(entry.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                      !isRead && "bg-primary/3"
                    )}
                  >
                    <div className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full transition-colors",
                      isRead ? "bg-muted-foreground/30" : "bg-primary"
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-xs leading-snug",
                        isRead ? "text-muted-foreground" : "text-foreground font-medium"
                      )}>
                        {entry.message}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  )
}</content>