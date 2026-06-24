"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { apiClient, API_BASE_URL } from "@/lib/api"
import { tokenStorage } from "@/lib/auth"

export const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "true"
const MOCK_USER_KEY = "wms:mock_user"

const DEMO_USER: User = {
  id: "demo-1",
  email: "demo@workos.app",
  name: "Demo User",
  bio: null,
  avatar_url: null,
  is_active: true,
  is_admin: false,
  created_at: new Date().toISOString(),
}

export type User = {
  id: string
  email: string
  name: string
  bio: string | null
  avatar_url: string | null
  is_active: boolean
  is_admin: boolean
  created_at: string
}

type AuthContextValue = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (data: Partial<User>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (MOCK_AUTH) {
      const stored = localStorage.getItem(MOCK_USER_KEY)
      if (stored) {
        try { setUser(JSON.parse(stored)) } catch { /* ignore */ }
      }
      setLoading(false)
      return
    }
    const token = tokenStorage.getAccess()
    if (!token) { setLoading(false); return }
    apiClient<User>("/users/me")
      .then(setUser)
      .catch(() => tokenStorage.clear())
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    if (MOCK_AUTH) {
      if (!email.trim()) throw new Error("Email required")
      const mockUser: User = { ...DEMO_USER, email, name: email.split("@")[0] }
      localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser))
      document.cookie = "has_session=1; path=/; max-age=86400"
      setUser(mockUser)
      return
    }
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Login failed" }))
      throw new Error(err.detail ?? "Login failed")
    }
    const data = await res.json()
    tokenStorage.setTokens(data.access_token, data.refresh_token)
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    if (MOCK_AUTH) {
      localStorage.removeItem(MOCK_USER_KEY)
      document.cookie = "has_session=; path=/; max-age=0"
      setUser(null)
      return
    }
    const refresh = tokenStorage.getRefresh()
    if (refresh) {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      }).catch(() => {})
    }
    tokenStorage.clear()
    setUser(null)
  }, [])

  const updateUser = useCallback((data: Partial<User>) => {
    setUser((prev) => {
      const next = prev ? { ...prev, ...data } : prev
      if (MOCK_AUTH && next) localStorage.setItem(MOCK_USER_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}