"use client"

import { formatDistanceToNow } from "date-fns"
import { CheckCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Notification } from "@/components/notifications/notification-types"

interface NotificationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  notifications: Notification[]
  onMarkRead: (id: string) => void
  onMarkAllRead: () => void
}

export function NotificationsModal({
  open,
  onOpenChange,
  notifications,
  onMarkRead,
  onMarkAllRead,
}: NotificationsModalProps) {
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[560px] p-0 flex flex-col max-h-[80vh] overflow-hidden">
        <DialogHeader className="flex flex-row items-center justify-between border-b px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <DialogTitle>Notifications</DialogTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={onMarkAllRead}
            >
              Mark all read
            </Button>
          )}
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          {notifications.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-muted-foreground">No notifications</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notification) => (
                <li
                  key={notification.id}
                  className={`group flex items-start gap-3 px-5 py-4 transition-opacity ${
                    notification.read ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {!notification.read && (
                      <span className="mt-[3px] size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium leading-snug">
                        {notification.title}
                      </span>
                      <p className="mt-0.5 text-sm text-muted-foreground leading-snug">
                        {notification.body}
                      </p>
                      <time className="mt-1 block text-xs text-muted-foreground/70">
                        {formatDistanceToNow(new Date(notification.createdAt), {
                          addSuffix: true,
                        })}
                      </time>
                    </div>
                  </div>
                  {!notification.read && (
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground shrink-0 p-1 rounded"
                      onClick={() => onMarkRead(notification.id)}
                      aria-label="Mark as read"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}