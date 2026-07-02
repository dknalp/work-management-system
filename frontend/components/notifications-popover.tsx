"use client"

import { useState, useEffect } from "react"
import { BellIcon, CheckCheckIcon, MessageCircleIcon, ListTodoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useNotifications } from "@/contexts/notifications-context"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"

export function NotificationsPopover() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9">
          <BellIcon className="size-4" />
          {mounted && unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white leading-none ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Bildirimler</h3>
            {mounted && unreadCount > 0 && (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold">
                {unreadCount}
              </Badge>
            )}
          </div>
          {mounted && unreadCount > 0 && (
            <Button
              variant="ghost" size="sm"
              className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={markAllRead}
            >
              <CheckCheckIcon className="size-3" />
              Tümünü okundu işaretle
            </Button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
            <BellIcon className="size-8 opacity-20" />
            <p className="text-sm">Henüz bildirim yok</p>
            <p className="text-xs opacity-70">DM ve görev olayları burada görünecek.</p>
          </div>
        ) : (
          <ScrollArea className="h-72">
            <div className="divide-y divide-border/40">
              {notifications.slice(0, 50).map((n) => {
                const isRead = false // we track unreadCount globally; individual read via click
                const isMsg = n.type === "message"
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40",
                    )}
                  >
                    {/* Icon */}
                    <div className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full",
                      isMsg ? "bg-blue-500/10 text-blue-500" : "bg-primary/10 text-primary",
                    )}>
                      {isMsg
                        ? <MessageCircleIcon className="size-3.5" />
                        : <ListTodoIcon className="size-3.5" />}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-xs font-medium leading-snug text-foreground">
                        {n.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground leading-snug">
                        {n.body}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {(() => {
                          try {
                            return formatDistanceToNow(new Date(n.timestamp), { addSuffix: true, locale: tr })
                          } catch {
                            return ""
                          }
                        })()}
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
}