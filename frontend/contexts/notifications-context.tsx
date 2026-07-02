"use client"

import React, {
  createContext, useContext, useEffect, useRef, useState, useCallback,
} from "react"
import { toast } from "sonner"
import { useAuth } from "./auth-context"
import { useTasks } from "./task-context"
import { tokenStorage } from "@/lib/auth"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const WS_BASE = API_BASE.replace(/^https/, "wss").replace(/^http/, "ws")

const LS_NOTIF_KEY = "wms:notifications"
const LS_READ_KEY  = "wms:notifications:read"
const LS_CHAT_READ = "wms:chat:read"
const MAX_STORED   = 100

// ── Types ─────────────────────────────────────────────────────────────────────

export type AppNotification = {
  id: string
  type: "message" | "task"
  title: string
  body: string
  timestamp: string
  metadata?: { contact_id?: string; room_id?: string; task_id?: string }
}

type NotificationsContextValue = {
  notifications: AppNotification[]
  unreadCount: number
  /** contact_id → unread count (for chat widget badge) */
  chatUnread: Record<string, number>
  markRead: (id: string) => void
  markAllRead: () => void
  /** Called by chat widget when a room is opened */
  markChatRead: (contactId: string, roomId: string) => void
  /** Called by chat widget when a message is sent (sender = up to date) */
  markChatSent: (contactId: string, roomId: string) => void
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function loadNotifications(): AppNotification[] {
  try { return JSON.parse(localStorage.getItem(LS_NOTIF_KEY) ?? "[]") } catch { return [] }
}
function saveNotifications(ns: AppNotification[]) {
  try { localStorage.setItem(LS_NOTIF_KEY, JSON.stringify(ns.slice(0, MAX_STORED))) } catch {}
}
function loadReadIds(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(LS_READ_KEY) ?? "[]")) } catch { return new Set() }
}
function saveReadIds(ids: Set<string>) {
  try { localStorage.setItem(LS_READ_KEY, JSON.stringify([...ids])) } catch {}
}
function loadChatRead(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(LS_CHAT_READ) ?? "{}") } catch { return {} }
}
function saveChatRead(m: Record<string, string>) {
  try { localStorage.setItem(LS_CHAT_READ, JSON.stringify(m)) } catch {}
}

// ── Context ───────────────────────────────────────────────────────────────────

const NotificationsContext = createContext<NotificationsContextValue>({
  notifications: [],
  unreadCount: 0,
  chatUnread: {},
  markRead: () => {},
  markAllRead: () => {},
  markChatRead: () => {},
  markChatSent: () => {},
})

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const { activity } = useTasks()

  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [chatUnread, setChatUnread] = useState<Record<string, number>>({})

  const seenActivityIds = useRef<Set<string>>(new Set())
  const activityInitialized = useRef(false)

  // Load persisted notifications on mount
  useEffect(() => {
    setNotifications(loadNotifications())
    setReadIds(loadReadIds())
  }, [])

  // ── Task activity → notifications ─────────────────────────────────────────

  useEffect(() => {
    if (activity.length === 0) return

    if (!activityInitialized.current) {
      // First load: mark all existing items as already seen
      activityInitialized.current = true
      activity.forEach((a) => seenActivityIds.current.add(a.id))
      return
    }

    const newItems = activity.filter((a) => !seenActivityIds.current.has(a.id))
    if (newItems.length === 0) return
    newItems.forEach((a) => seenActivityIds.current.add(a.id))

    const newNotifs: AppNotification[] = newItems.map((a) => ({
      id: `task-${a.id}`,
      type: "task" as const,
      title: a.taskTitle,
      body: a.detail ? `${a.type} — ${a.detail}` : a.type,
      timestamp: a.timestamp,
      metadata: { task_id: a.taskId },
    }))

    setNotifications((prev) => {
      const merged = [...newNotifs, ...prev].slice(0, MAX_STORED)
      saveNotifications(merged)
      return merged
    })

    // Toast for each new task event
    newItems.forEach((a) => {
      toast(a.taskTitle, {
        description: a.detail ?? a.type,
      })
    })
  }, [activity])

  // ── Notification WebSocket (DMs) ──────────────────────────────────────────

  useEffect(() => {
    if (!user?.id) return
    const token = tokenStorage.getAccess()
    if (!token) return

    let ws: WebSocket
    let dead = false
    let retryTimer: ReturnType<typeof setTimeout>

    const connect = () => {
      if (dead) return
      ws = new WebSocket(`${WS_BASE}/api/v1/ws/notifications?token=${token}`)

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type !== "new_message") return

          const { contact_id, sender_name, text, room_id } = msg as {
            contact_id: string; sender_name: string; text: string; room_id: string
          }

          // Check if this room is currently "read" in chat localStorage
          const chatReadMap = loadChatRead()
          const lastRead = chatReadMap[room_id]
          const now = new Date().toISOString()

          // Increment chat unread badge
          setChatUnread((prev) => ({ ...prev, [contact_id]: (prev[contact_id] ?? 0) + 1 }))

          // Add to notification list
          const notif: AppNotification = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            type: "message",
            title: sender_name,
            body: text.length > 80 ? text.slice(0, 80) + "…" : text,
            timestamp: now,
            metadata: { contact_id, room_id },
          }
          setNotifications((prev) => {
            const merged = [notif, ...prev].slice(0, MAX_STORED)
            saveNotifications(merged)
            return merged
          })

          // Toast
          toast(sender_name, {
            description: text.length > 60 ? text.slice(0, 60) + "…" : text,
            action: { label: "Mesajlar", onClick: () => {} },
          })
        } catch {}
      }

      ws.onclose = () => { if (!dead) retryTimer = setTimeout(connect, 5000) }
    }

    connect()
    return () => {
      dead = true
      clearTimeout(retryTimer)
      ws?.close()
    }
  }, [user?.id])

  // ── Chat unread: compute from localStorage on mount ───────────────────────

  // (chat-widget will call markChatRead / markChatSent to update)

  // ── Marks ─────────────────────────────────────────────────────────────────

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set([...prev, id])
      saveReadIds(next)
      return next
    })
  }, [])

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set([...prev, ...notifications.map((n) => n.id)])
      saveReadIds(next)
      return next
    })
  }, [notifications])

  const markChatRead = useCallback((contactId: string, roomId: string) => {
    setChatUnread((prev) => { const next = { ...prev }; delete next[contactId]; return next })
    const m = loadChatRead()
    m[roomId] = new Date().toISOString()
    saveChatRead(m)
  }, [])

  const markChatSent = useCallback((contactId: string, roomId: string) => {
    const m = loadChatRead()
    m[roomId] = new Date().toISOString()
    saveChatRead(m)
  }, [])

  const unreadCount = notifications.filter((n) => !readIds.has(n.id)).length

  return (
    <NotificationsContext.Provider value={{
      notifications, unreadCount, chatUnread,
      markRead, markAllRead, markChatRead, markChatSent,
    }}>
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  return useContext(NotificationsContext)
}