"use client"

import React, { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useAuth } from "./auth-context"
import { tokenStorage } from "@/lib/auth"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3052").replace(/\/$/, "")
const HEARTBEAT_MS = 30_000
const POLL_MS = 30_000

export type OnlineUser = {
  id: string
  name: string
  email: string
  type: "user"
}

type PresenceContextValue = {
  onlineUsers: OnlineUser[]
  isOnlineById: (id: string) => boolean
  isOnlineByEmail: (email: string) => boolean
}

const PresenceContext = createContext<PresenceContextValue>({
  onlineUsers: [],
  isOnlineById: () => false,
  isOnlineByEmail: () => false,
})

export function PresenceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([])

  const sendHeartbeat = useCallback(async () => {
    const token = tokenStorage.getAccess()
    if (!token) return
    try {
      await fetch(`${API_BASE}/api/v1/presence/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch {}
  }, [])

  const fetchOnline = useCallback(async () => {
    const token = tokenStorage.getAccess()
    if (!token) return
    try {
      const r = await fetch(`${API_BASE}/api/v1/presence/online`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (r.ok) setOnlineUsers(await r.json())
    } catch {}
  }, [])

  useEffect(() => {
    if (!user?.id) return
    sendHeartbeat()
    fetchOnline()
    const hb = setInterval(sendHeartbeat, HEARTBEAT_MS)
    const poll = setInterval(fetchOnline, POLL_MS)
    return () => {
      clearInterval(hb)
      clearInterval(poll)
    }
  }, [user?.id, sendHeartbeat, fetchOnline])

  const isOnlineById = useCallback(
    (id: string) => onlineUsers.some((u) => u.id === id),
    [onlineUsers]
  )
  const isOnlineByEmail = useCallback(
    (email: string) => onlineUsers.some((u) => u.email === email),
    [onlineUsers]
  )

  return (
    <PresenceContext.Provider value={{ onlineUsers, isOnlineById, isOnlineByEmail }}>
      {children}
    </PresenceContext.Provider>
  )
}

export function usePresence() {
  return useContext(PresenceContext)
}