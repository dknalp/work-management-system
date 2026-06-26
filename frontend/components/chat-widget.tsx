"use client"

import React, { useState, useRef, useEffect } from "react"
import { MessageCircleIcon, SendIcon, XIcon, ChevronLeftIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Message = {
  id: string
  text: string
  from: "me" | "other"
  time: string
}

type Conversation = {
  id: string
  name: string
  lastMessage: string
  time: string
  color: string
  initials: string
  messages: Message[]
}

const CONVERSATIONS: Conversation[] = [
  {
    id: "1",
    name: "Team General",
    lastMessage: "Hey! How's the project going?",
    time: "10:30",
    color: "bg-violet-500",
    initials: "TG",
    messages: [
      { id: "m1", text: "Sprint planning tomorrow at 10am 🚀", from: "other", time: "10:28" },
      { id: "m2", text: "Got it, I'll be there!", from: "me", time: "10:29" },
      { id: "m3", text: "Hey! How's the project going?", from: "other", time: "10:30" },
    ],
  },
  {
    id: "2",
    name: "Alice Johnson",
    lastMessage: "Can you review my PR?",
    time: "09:15",
    color: "bg-blue-500",
    initials: "AJ",
    messages: [
      { id: "m1", text: "Hi! Can you review my PR when you get a chance?", from: "other", time: "09:14" },
      { id: "m2", text: "Sure, I'll take a look!", from: "me", time: "09:15" },
    ],
  },
  {
    id: "3",
    name: "Bob Smith",
    lastMessage: "Thanks!",
    time: "Yesterday",
    color: "bg-emerald-500",
    initials: "BS",
    messages: [
      { id: "m1", text: "I've finished the dashboard component", from: "other", time: "Yesterday" },
      { id: "m2", text: "Great work!", from: "me", time: "Yesterday" },
      { id: "m3", text: "Thanks!", from: "other", time: "Yesterday" },
    ],
  },
  {
    id: "4",
    name: "Carol Williams",
    lastMessage: "Meeting at 3pm",
    time: "Yesterday",
    color: "bg-orange-500",
    initials: "CW",
    messages: [
      { id: "m1", text: "Quick reminder: meeting at 3pm today", from: "other", time: "Yesterday" },
      { id: "m2", text: "Thanks for the heads up!", from: "me", time: "Yesterday" },
    ],
  },
]

function nowStr() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [convos, setConvos] = useState(CONVERSATIONS)
  const [input, setInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const active = convos.find((c) => c.id === activeId) ?? null

  useEffect(() => {
    if (active) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [active, active?.messages.length, active?.id])

  useEffect(() => {
    if (active) inputRef.current?.focus()
  }, [active, active?.id])

  function send() {
    const text = input.trim()
    if (!text || !activeId) return
    const time = nowStr()
    setConvos((prev) =>
      prev.map((c) =>
        c.id === activeId
          ? {
              ...c,
              lastMessage: text,
              time,
              messages: [...c.messages, { id: `m-${Date.now()}`, text, from: "me", time }],
            }
          : c
      )
    )
    setInput("")
    setTimeout(() => {
      const reply: Message = {
        id: `r-${Date.now()}`,
        text: "Got it! This is a demo workspace chat.",
        from: "other",
        time: nowStr(),
      }
      setConvos((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, lastMessage: reply.text, time: reply.time, messages: [...c.messages, reply] }
            : c
        )
      )
    }, 900)
  }

  return (
    /*
     * Single morphing element — fixed to bottom-right.
     * Closed: 48×48 circle (FAB).
     * Open:   340×460 rounded rectangle (chat panel).
     * The shape expands upward + leftward from the fixed bottom-right anchor.
     */
    <div
      className="fixed bottom-5 right-5 z-50 overflow-hidden"
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
      {/* ── FAB icon layer — shown when closed ── */}
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

      {/* ── Chat panel content — shown when open ── */}
      <div
        className="absolute inset-0 flex flex-col"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
          transition: open ? "opacity 180ms ease-in 160ms" : "opacity 120ms ease-out",
        }}
      >
        {active ? (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-3 border-b border-border/60 bg-card px-4 py-3">
              <button
                onClick={() => setActiveId(null)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Geri"
              >
                <ChevronLeftIcon className="size-4" />
              </button>
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", active.color)}>
                {active.initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{active.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Çevrimiçi
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Sohbeti kapat"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
              {active.messages.map((msg, i) => {
                const isMe = msg.from === "me"
                const prevSame = i > 0 && active.messages[i - 1].from === msg.from
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
                            : "rounded-bl-sm bg-muted text-foreground"
                        )}
                      >
                        {msg.text}
                      </div>
                      {(!active.messages[i + 1] || active.messages[i + 1].from !== msg.from) && (
                        <span className="mt-1 px-1 text-[11px] text-muted-foreground/70">{msg.time}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
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
                />
                <button
                  onClick={send}
                  disabled={!input.trim()}
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
            {/* Conversation list header */}
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
              <p className="text-sm font-semibold">Mesajlar</p>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Kapat"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex flex-1 flex-col overflow-y-auto">
              {convos.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                >
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white", c.color)}>
                    {c.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{c.time}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{c.lastMessage}</p>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
