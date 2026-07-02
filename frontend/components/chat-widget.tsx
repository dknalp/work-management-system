"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { MessageCircleIcon, SendIcon, XIcon, ChevronLeftIcon, Loader2Icon } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { usePresence } from "@/contexts/presence-context"
import { useNotifications } from "@/contexts/notifications-context"
import { tokenStorage } from "@/lib/auth"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "")
const WS_BASE = API_BASE.replace(/^https/, "wss").replace(/^http/, "ws")

type ChatMessage = {
  id: string
  room_id: string
  sender_id: string
  sender_name: string
  sender_type: "user" | "bot"
  text: string
  created_at: string
}

type Contact = {
  id: string
  name: string
  type: "user" | "bot"
  is_active: boolean
  last_message?: { text: string; created_at: string } | null
}

const COLORS = [
  "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500",
  "bg-pink-500", "bg-cyan-500", "bg-amber-500", "bg-indigo-500",
]

function getInitials(name: string): string {
  return name.split(" ").map((p) => p[0] ?? "").join("").toUpperCase().slice(0, 2) || "?"
}

function getColor(id: string): string {
  let h = 0
  for (const ch of id) h = ((h * 31) + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

function makeRoomId(a: string, b: string): string {
  return [a, b].sort().join("_")
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return ""
  }
}

export function ChatWidget() {
  const { user } = useAuth()
  const { isOnlineById } = usePresence()
  const { chatUnread, markChatRead, markChatSent } = useNotifications()

  const [open, setOpen] = useState(false)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [activeContact, setActiveContact] = useState<Contact | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [connError, setConnError] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const activeContactRef = useRef<Contact | null>(null)
  activeContactRef.current = activeContact

  const totalUnread = Object.values(chatUnread).reduce((s, n) => s + n, 0)

  // Load contacts when widget opens
  useEffect(() => {
    if (!open || !user?.id) return
    const token = tokenStorage.getAccess()
    if (!token) return
    fetch(`${API_BASE}/api/v1/messages/contacts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Contact[]) => {
        if (!Array.isArray(data)) return
        setContacts(data)
      })
      .catch(() => {})
  }, [open, user?.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length])

  // Focus input when conversation opens
  useEffect(() => {
    if (activeContact) inputRef.current?.focus()
  }, [activeContact])

  // Cleanup chat WS on unmount
  useEffect(() => {
    return () => { wsRef.current?.close() }
  }, [])

  const closeConversation = useCallback(() => {
    wsRef.current?.close()
    wsRef.current = null
    setActiveContact(null)
    setMessages([])
    setInput("")
    setConnError(false)
  }, [])

  const openConversation = useCallback(async (contact: Contact) => {
    if (!user?.id) return
    const token = tokenStorage.getAccess()
    if (!token) return

    wsRef.current?.close()
    wsRef.current = null

    setActiveContact(contact)
    setMessages([])
    setLoading(true)
    setConnError(false)

    const roomId = makeRoomId(user.id, contact.id)
    markChatRead(contact.id, roomId)

    const ws = new WebSocket(`${WS_BASE}/api/v1/ws/chat/${roomId}?token=${token}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.type === "history") {
          setMessages(Array.isArray(msg.data) ? msg.data : [])
          setLoading(false)
        } else if (msg.type === "message") {
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.data.id)) return prev
            const filtered = prev.filter(
              (m) => !(m.id.startsWith("opt-") && m.text === msg.data.text && m.sender_id === msg.data.sender_id)
            )
            return [...filtered, msg.data]
          })
        }
      } catch {}
    }

    ws.onerror = () => { setConnError(true); setLoading(false) }
    ws.onclose = () => {
      if (wsRef.current === ws) { setConnError(true); setLoading(false) }
    }
  }, [user?.id, markChatRead])

  const send = useCallback(() => {
    const text = input.trim()
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !user?.id || !activeContactRef.current) return

    const optimistic: ChatMessage = {
      id: `opt-${Date.now()}`,
      room_id: makeRoomId(user.id, activeContactRef.current.id),
      sender_id: user.id,
      sender_name: user.name ?? "",
      sender_type: "user",
      text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setInput("")
    wsRef.current.send(JSON.stringify({ text }))
    const roomId = makeRoomId(user.id, activeContactRef.current.id)
    markChatSent(activeContactRef.current.id, roomId)
  }, [input, user?.id, user?.name, markChatSent])

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Unread badge — outside overflow-hidden so it's never clipped */}
      {!open && totalUnread > 0 && (
        <span className="absolute -top-2 -right-2 z-10 flex min-w-[20px] h-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-background shadow-md">
          {totalUnread > 9 ? "9+" : totalUnread}
        </span>
      )}

      <div
        className="overflow-hidden"
        style={{
          width: open ? 340 : 48,
          height: open ? 460 : 48,
          borderRadius: open ? 16 : 24,
          backgroundColor: open ? "var(--card)" : "var(--primary)",
          boxShadow: open
            ? "0 25px 50px -12px rgba(0,0,0,0.15), inset 0 0 0 1px oklch(0.87 0.020 80 / 0.6)"
            : "0 10px 25px -5px rgba(0,0,0,0.25), 0 4px 6px -2px rgba(0,0,0,0.15)",
          transition:
            "width 320ms cubic-bezier(0.4,0,0.2,1), height 320ms cubic-bezier(0.4,0,0.2,1), border-radius 320ms cubic-bezier(0.4,0,0.2,1), background-color 320ms cubic-bezier(0.4,0,0.2,1), box-shadow 320ms cubic-bezier(0.4,0,0.2,1)",
        }}
      >
      {/* FAB — closed state */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Sohbeti aç"
        className="absolute inset-0 flex items-center justify-center text-primary-foreground"
        style={{
          opacity: open ? 0 : 1,
          pointerEvents: open ? "none" : "auto",
          transition: open ? "opacity 120ms ease-out" : "opacity 150ms ease-in 200ms",
        }}
      >
        <MessageCircleIcon className="size-5" />
      </button>

      {/* Chat panel — open state */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: open ? "opacity 180ms ease-in 160ms" : "opacity 120ms ease-out",
        }}
      >
        {activeContact ? (
          <>
            {/* Conversation header */}
            <div className="flex items-center gap-3 border-b border-border/60 bg-card px-4 py-3">
              <button
                onClick={closeConversation}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Geri"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", getColor(activeContact.id))}>
                {getInitials(activeContact.name)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{activeContact.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  {activeContact.type === "user" ? (
                    <>
                      <span className={cn("size-1.5 rounded-full", isOnlineById(activeContact.id) ? "bg-emerald-500" : "bg-zinc-400")} />
                      {isOnlineById(activeContact.id) ? "Çevrimiçi" : "Çevrimdışı"}
                    </>
                  ) : (
                    <>
                      <span className="size-1.5 rounded-full bg-violet-400" />
                      Bot
                    </>
                  )}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Kapat"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
              {loading ? (
                <div className="flex flex-1 items-center justify-center">
                  <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
                </div>
              ) : connError ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2">
                  <p className="text-xs text-destructive">Bağlantı kurulamadı</p>
                  <button
                    onClick={() => openConversation(activeContact)}
                    className="rounded-md bg-muted px-3 py-1.5 text-xs transition-colors hover:bg-muted/80"
                  >
                    Yeniden bağlan
                  </button>
                </div>
              ) : (
                <>
                  {messages.length === 0 && (
                    <div className="flex flex-1 items-center justify-center">
                      <p className="text-xs text-muted-foreground">Henüz mesaj yok. İlk mesajı gönder!</p>
                    </div>
                  )}
                  {messages.map((msg, i) => {
                    const isMe = msg.sender_id === user?.id
                    const prevSame = i > 0 && messages[i - 1].sender_id === msg.sender_id
                    return (
                      <div
                        key={msg.id}
                        className={cn("flex w-full", isMe ? "justify-end" : "justify-start", prevSame ? "mt-0.5" : "mt-3")}
                      >
                        <div className={cn("flex max-w-[75%] flex-col", isMe ? "items-end" : "items-start")}>
                          <div
                            className={cn(
                              "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                              isMe
                                ? "rounded-br-sm bg-primary text-primary-foreground"
                                : "rounded-bl-sm bg-muted text-foreground",
                              msg.id.startsWith("opt-") && "opacity-60",
                            )}
                          >
                            {msg.text}
                          </div>
                          {(!messages[i + 1] || messages[i + 1].sender_id !== msg.sender_id) && (
                            <span className="mt-1 px-1 text-[11px] text-muted-foreground/70">
                              {fmtTime(msg.created_at)}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={bottomRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-border/60 bg-card px-3 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 transition-all focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Mesaj yaz…"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
                  disabled={connError}
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || connError}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-all hover:opacity-90 disabled:opacity-30"
                  aria-label="Gönder"
                >
                  <SendIcon className="size-3.5" />
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Contact list header */}
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">
                Mesajlar
                {totalUnread > 0 && (
                  <span className="ml-2 inline-flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Kapat"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Contact list */}
            <div className="flex flex-1 flex-col overflow-y-auto">
              {contacts.length === 0 ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-xs text-muted-foreground">Kontak bulunamadı</p>
                </div>
              ) : (
                contacts.map((c) => {
                  const unreadCount = chatUnread[c.id] ?? 0
                  const online = c.type === "user" && isOnlineById(c.id)
                  return (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c)}
                      className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                    >
                      <div className="relative">
                        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", getColor(c.id))}>
                          {getInitials(c.name)}
                        </div>
                        <span className={cn(
                          "absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-background",
                          c.type === "bot" ? "bg-violet-400" : online ? "bg-emerald-500" : "bg-zinc-400"
                        )} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={cn("truncate text-sm font-medium", unreadCount > 0 && "font-semibold")}>{c.name}</p>
                        {c.last_message ? (
                          <p className={cn("truncate text-xs", unreadCount > 0 ? "font-medium text-foreground" : "text-muted-foreground")}>
                            {c.last_message.text}
                          </p>
                        ) : null}
                      </div>
                      {unreadCount > 0 && (
                        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}