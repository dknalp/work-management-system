"use client"

import { useState, useRef, useEffect } from "react"
import { MessageCircleIcon, XIcon, SendIcon } from "lucide-react"
import { cn } from "@/lib/utils"

type Message = {
  id: string
  text: string
  from: "me" | "other"
  time: string
}

type Contact = {
  id: string
  name: string
  initials: string
  lastMessage: string
  time: string
  unread: number
  color: string
}

const CONTACTS: Contact[] = [
  { id: "general", name: "Team General",   initials: "TG", lastMessage: "Hey! How's the project going?", time: "10:30", unread: 2, color: "bg-violet-500"  },
  { id: "alice",   name: "Alice Johnson",  initials: "AJ", lastMessage: "Can you review my PR?",         time: "09:15", unread: 1, color: "bg-blue-500"    },
  { id: "bob",     name: "Bob Smith",      initials: "BS", lastMessage: "Thanks!",                       time: "Dün",   unread: 0, color: "bg-emerald-500" },
  { id: "carol",   name: "Carol Williams", initials: "CW", lastMessage: "Meeting at 3pm",                time: "Dün",   unread: 0, color: "bg-orange-500"  },
]

const INITIAL_MESSAGES: Record<string, Message[]> = {
  general: [
    { id: "g1", text: "Sprint planning tomorrow at 10am 🚀", from: "other", time: "10:28" },
    { id: "g2", text: "Got it, I'll be there!",               from: "me",    time: "10:29" },
    { id: "g3", text: "Hey! How's the project going?",        from: "other", time: "10:30" },
  ],
  alice: [
    { id: "a1", text: "Hi! Can you review my PR when you get a chance?", from: "other", time: "09:14" },
    { id: "a2", text: "Sure, I'll take a look!",                          from: "me",    time: "09:15" },
  ],
  bob: [
    { id: "b1", text: "I've finished the dashboard component", from: "other", time: "Dün" },
    { id: "b2", text: "Great work!",                           from: "me",    time: "Dün" },
    { id: "b3", text: "Thanks!",                               from: "other", time: "Dün" },
  ],
  carol: [
    { id: "c1", text: "Quick reminder: meeting at 3pm today", from: "other", time: "Dün" },
    { id: "c2", text: "Thanks for the heads up!",              from: "me",    time: "Dün" },
  ],
}

function nowStr() {
  return new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

export function ChatWidget() {
  const [open, setOpen]               = useState(false)
  const [active, setActive]           = useState("general")
  const [messages, setMessages]       = useState(INITIAL_MESSAGES)
  const [contacts, setContacts]       = useState(CONTACTS)
  const [input, setInput]             = useState("")
  const bottomRef                     = useRef<HTMLDivElement>(null)
  const inputRef                      = useRef<HTMLInputElement>(null)

  // Scroll to bottom & focus input when opening or switching contacts
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "instant" })
      setTimeout(() => inputRef.current?.focus(), 180)
    }
  }, [open, active])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const selectContact = (id: string) => {
    setActive(id)
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)))
  }

  const send = () => {
    const text = input.trim()
    if (!text) return
    const msg: Message = { id: `m-${Date.now()}`, text, from: "me", time: nowStr() }
    setMessages((prev) => ({ ...prev, [active]: [...(prev[active] ?? []), msg] }))
    setContacts((prev) => prev.map((c) => (c.id === active ? { ...c, lastMessage: text, time: nowStr() } : c)))
    setInput("")
    setTimeout(() => {
      const reply: Message = { id: `r-${Date.now()}`, text: "Got it! This is a demo workspace chat.", from: "other", time: nowStr() }
      setMessages((prev) => ({ ...prev, [active]: [...(prev[active] ?? []), reply] }))
    }, 800)
  }

  const activeContact = contacts.find((c) => c.id === active)
  const currentMessages = messages[active] ?? []

  return (
    /* Anchor: fixed bottom-right. Both FAB and panel share this origin (bottom-0 right-0). */
    <div className="fixed bottom-6 right-6 z-50" style={{ width: 56, height: 56 }}>

      {/* ── FAB button ── shown when closed, hides when open */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Open chat"
        className={cn(
          "absolute bottom-0 right-0 flex size-14 items-center justify-center rounded-full",
          "bg-primary text-primary-foreground shadow-lg",
          "transition-all duration-200 ease-out hover:scale-105 hover:shadow-xl",
          open ? "scale-50 opacity-0 pointer-events-none" : "scale-100 opacity-100"
        )}
      >
        <MessageCircleIcon className="size-6" />
      </button>

      {/* ── Chat panel ── grows from bottom-right (same anchor as FAB) */}
      <div
        className={cn(
          "absolute bottom-0 right-0 origin-bottom-right",
          "transition-all duration-200 ease-out",
          open ? "scale-100 opacity-100" : "scale-0 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex h-[480px] w-[580px] overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl">

          {/* Left: contact list */}
          <div className="flex w-[190px] shrink-0 flex-col border-r border-border/60 bg-muted/20">
            <div className="px-3 py-3 border-b border-border/60">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mesajlar
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => selectContact(contact.id)}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors",
                    active === contact.id ? "bg-primary/10" : "hover:bg-muted/40"
                  )}
                >
                  <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", contact.color)}>
                    {contact.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className={cn("truncate text-xs font-semibold", active === contact.id ? "text-primary" : "text-foreground")}>
                        {contact.name}
                      </p>
                      {contact.unread > 0 && (
                        <span className="flex size-[17px] shrink-0 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                          {contact.unread}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[10px] text-muted-foreground">{contact.lastMessage}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: conversation */}
          <div className="flex flex-1 flex-col min-w-0">

            {/* Header */}
            <div className="flex shrink-0 items-center gap-3 bg-primary px-4 py-3">
              <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", activeContact?.color ?? "bg-white/20")}>
                {activeContact?.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-tight">{activeContact?.name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="size-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-white/70">Online</span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close chat"
              >
                <XIcon className="size-4" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-2 bg-muted/10 px-3 py-3">
              {currentMessages.map((msg) => (
                <div key={msg.id} className={cn("flex flex-col", msg.from === "me" ? "items-end" : "items-start")}>
                  <div className={cn(
                    "max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-snug",
                    msg.from === "me"
                      ? "rounded-br-[4px] bg-primary text-primary-foreground"
                      : "rounded-bl-[4px] border border-border/60 bg-card text-foreground"
                  )}>
                    {msg.text}
                  </div>
                  <span className="mt-0.5 px-1 text-[10px] text-muted-foreground">{msg.time}</span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Input bar */}
            <div className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-card px-3 py-2.5">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send() }}
                placeholder="Mesaj yaz…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={send}
                disabled={!input.trim()}
                aria-label="Gönder"
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                  input.trim()
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "cursor-not-allowed bg-muted text-muted-foreground"
                )}
              >
                <SendIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}