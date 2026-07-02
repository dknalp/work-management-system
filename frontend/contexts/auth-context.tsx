"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { apiClient, API_BASE_URL } from "@/lib/api"
import { tokenStorage } from "@/lib/auth"

export const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "true"
const MOCK_USER_KEY = "wms:mock_user"
const MOCK_USERS_KEY = "wms:mock_users"

export type User = {
  id: string
  email: string
  name: string
  bio: string | null
  avatar_url: string | null
  is_active: boolean
  is_admin: boolean
  role: string
  created_at: string
}

const MOCK_USERS_SEED: User[] = [
  {
    id: "user-1",
    email: "admin@workos.com",
    name: "Admin",
    bio: null,
    avatar_url: null,
    is_active: true,
    is_admin: true,
    role: "admin",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "user-2",
    email: "demo@workos.app",
    name: "Demo User",
    bio: null,
    avatar_url: null,
    is_active: true,
    is_admin: false,
    role: "member",
    created_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "user-3",
    email: "yetkili@workos.app",
    name: "Yetkili Kullanıcı",
    bio: null,
    avatar_url: null,
    is_active: true,
    is_admin: false,
    role: "manager",
    created_at: "2024-02-01T00:00:00.000Z",
  },
  {
    id: "user-4",
    email: "uye@workos.app",
    name: "Üye Kullanıcı",
    bio: null,
    avatar_url: null,
    is_active: true,
    is_admin: false,
    role: "member",
    created_at: "2024-03-01T00:00:00.000Z",
  },
]

function getMockRegistry(): User[] {
  if (typeof window === "undefined") return MOCK_USERS_SEED
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY)
    if (!raw) return MOCK_USERS_SEED
    const stored: User[] = JSON.parse(raw)
    // Merge with seed defaults to fill in fields added after initial storage (e.g., role)
    return stored.map((u) => {
      const seed = MOCK_USERS_SEED.find((s) => s.id === u.id)
      return seed ? { ...seed, ...u } : u
    })
  } catch {
    return MOCK_USERS_SEED
  }
}

function saveMockRegistry(users: User[]) {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users))
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
        try {
          const parsed: User = JSON.parse(stored)
          const seed = MOCK_USERS_SEED.find((s) => s.id === parsed.id)
          const merged = seed ? { ...seed, ...parsed, role: parsed.role ?? seed.role } : parsed
          setUser(merged)
          // Persist merged back so future loads are correct
          localStorage.setItem(MOCK_USER_KEY, JSON.stringify(merged))
        } catch { /* ignore */ }
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
      const registry = getMockRegistry()
      const found = registry.find((u) => u.email.toLowerCase() === email.toLowerCase())
      if (found && !found.is_active) throw new Error("This account has been deactivated.")
      const mockUser: User = found ?? {
        id: `user-${Date.now()}`,
        email,
        name: email.split("@")[0],
        bio: null,
        avatar_url: null,
        is_active: true,
        is_admin: false,
        role: "member",
        created_at: new Date().toISOString(),
      }
      localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser))
      document.cookie = "has_session=1; path=/; max-age=86400"
      document.cookie = `is_admin=${mockUser.is_admin ? "1" : "0"}; path=/; max-age=86400`
      document.cookie = `user_role=${mockUser.role ?? "member"}; path=/; max-age=86400`
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
    if (data.user?.role) {
      document.cookie = `user_role=${data.user.role}; path=/; max-age=${7 * 86400}; SameSite=Lax`
    }
    if (data.user?.is_admin) {
      document.cookie = `is_admin=1; path=/; max-age=${7 * 86400}; SameSite=Lax`
    }
    setUser(data.user)
  }, [])

  const logout = useCallback(async () => {
    if (MOCK_AUTH) {
      localStorage.removeItem(MOCK_USER_KEY)
      document.cookie = "has_session=; path=/; max-age=0"
      document.cookie = "is_admin=; path=/; max-age=0"
      document.cookie = "user_role=; path=/; max-age=0"
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
    document.cookie = "user_role=; path=/; max-age=0"
    document.cookie = "is_admin=; path=/; max-age=0"
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

export function useMockUsers() {
  const { user: currentUser, updateUser } = useAuth()
  const [mockUsers, setMockUsers] = useState<User[]>(() => getMockRegistry())

  const updateMockUser = useCallback((id: string, patch: Partial<User>) => {
    const registry = getMockRegistry()
    const updated = registry.map((u) => (u.id === id ? { ...u, ...patch } : u))
    saveMockRegistry(updated)
    setMockUsers(updated)
    if (currentUser?.id === id) {
      updateUser(patch)
      if (patch.is_admin !== undefined) {
        document.cookie = `is_admin=${patch.is_admin ? "1" : "0"}; path=/; max-age=86400`
      }
      if (patch.role !== undefined) {
        document.cookie = `user_role=${patch.role}; path=/; max-age=86400`
      }
    }
  }, [currentUser, updateUser])

  return { mockUsers, updateMockUser }
}