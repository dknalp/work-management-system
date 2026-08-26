"use client"

/**
 * Authentication context — Firebase Auth-based.
 *
 * Provides `user`, `loading`, `login`, `logout`, `updateUser` to the app.
 *
 * Auth flow:
 *  - `login(email, password)` → `signInWithEmailAndPassword` (Firebase)
 *    → `user.getIdToken()` → store in tokenStorage → fetch `/users/me`
 *  - `logout()` → `signOut(firebaseAuth)` → tokenStorage.clear()
 *  - Session restore on mount via `onIdTokenChanged` observer:
 *    Firebase fires this when the SDK loads a cached session, on token
 *    refresh, or on sign-in/out.  We get the fresh ID token and reload
 *    the user profile from the backend.
 *
 * Cookie sync (for Next.js middleware in proxy.ts):
 *  - `has_session`  — set when signed in, cleared on logout
 *  - `is_admin`     — set from /users/me response
 *  - `user_role`    — set from /users/me response
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase"
import { tokenStorage } from "@/lib/auth"
import { apiClient } from "@/lib/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  name: string
  email: string
  role: string
  is_admin: boolean
  is_active: boolean
  bio?: string | null
  avatar_url?: string | null
  /** Alias for avatar_url — some components use this shorter form. */
  avatar?: string | null
  created_at: string
}

interface AuthContextValue {
  user: AuthUser | null
  /** Permissions fetched in parallel with the user profile on every session restore. */
  permissions: string[] | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateUser: (partial: Partial<AuthUser>) => void
}

// ---------------------------------------------------------------------------
// Mock auth (when NEXT_PUBLIC_MOCK_AUTH=true)
// ---------------------------------------------------------------------------

export const MOCK_AUTH = process.env.NEXT_PUBLIC_MOCK_AUTH === "true"

if (MOCK_AUTH && process.env.NODE_ENV === "production") {
  throw new Error("NEXT_PUBLIC_MOCK_AUTH must not be enabled in production builds.")
}

const MOCK_USER_KEY = "wms:mock_user"
const MOCK_ADMIN: AuthUser = {
  id: "mock-admin",
  name: "Mock Admin",
  email: "admin@example.com",
  role: "admin",
  is_admin: true,
  is_active: true,
  created_at: new Date().toISOString(),
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue>({
  user: null,
  permissions: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  updateUser: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [permissions, setPermissions] = useState<string[] | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Cookie helpers ────────────────────────────────────────────────────────

  function _syncRoleCookies(u: AuthUser) {
    if (typeof document === "undefined") return
    document.cookie = `is_admin=${u.is_admin ? "1" : "0"}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`
    document.cookie = `user_role=${u.role}; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`
  }

  function _clearRoleCookies() {
    if (typeof document === "undefined") return
    document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax; Secure"
    document.cookie = "user_role=; path=/; max-age=0; SameSite=Lax; Secure"
  }

  // ── Mock auth mode ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!MOCK_AUTH) return
    try {
      const stored = localStorage.getItem(MOCK_USER_KEY)
      const mockUser: AuthUser = stored ? JSON.parse(stored) : MOCK_ADMIN
      setUser(mockUser)
      setPermissions(null)  // mock permissions resolved by PermissionsProvider
      _syncRoleCookies(mockUser)
    } catch (err) {
      console.error("[auth] Failed to load mock user:", err)
      setUser(MOCK_ADMIN)
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Firebase auth observer ────────────────────────────────────────────────

  useEffect(() => {
    if (MOCK_AUTH) return

    console.debug("[auth] Subscribing to Firebase onIdTokenChanged")

    const unsubscribe = onIdTokenChanged(
      firebaseAuth,
      async (firebaseUser: FirebaseUser | null) => {
        if (!firebaseUser) {
          console.debug("[auth] No Firebase session — clearing user state")
          tokenStorage.clear()
          _clearRoleCookies()
          setUser(null)
          setLoading(false)
          return
        }

        try {
          console.debug("[auth] Firebase user present — fetching ID token")
          const idToken = await firebaseUser.getIdToken()
          tokenStorage.setToken(idToken)

          // Fetch profile and permissions in parallel — saves one full round-trip
          console.debug("[auth] Fetching /api/v1/me and /permissions/my in parallel")
          const [me, permsData] = await Promise.all([
            apiClient<AuthUser>("/api/v1/me"),
            apiClient<{ permissions: string[] }>("/permissions/my").catch(() => ({ permissions: [] })),
          ])
          _syncRoleCookies(me)
          setUser(me)
          setPermissions(permsData.permissions ?? [])
          console.debug("[auth] Session restored, role:", me.role)
        } catch (err) {
          // Backend unreachable or token rejected — sign out cleanly
          console.error("[auth] Failed to load user profile after Firebase auth:", err)
          try {
            await signOut(firebaseAuth)
          } catch (signOutErr) {
            console.error("[auth] signOut also failed:", signOutErr)
          }
          tokenStorage.clear()
          _clearRoleCookies()
          setUser(null)
          setPermissions(null)
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        console.error("[auth] onIdTokenChanged error:", err)
        tokenStorage.clear()
        _clearRoleCookies()
        setUser(null)
        setLoading(false)
      }
    )

    return () => {
      console.debug("[auth] Unsubscribing from Firebase onIdTokenChanged")
      unsubscribe()
    }
  }, [])

  // ── login ─────────────────────────────────────────────────────────────────

  const login = useCallback(async (email: string, password: string) => {
    if (MOCK_AUTH) {
      const mockUser = { ...MOCK_ADMIN, email, name: email.split("@")[0] }
      localStorage.setItem(MOCK_USER_KEY, JSON.stringify(mockUser))
      setUser(mockUser)
      _syncRoleCookies(mockUser)
      return
    }

    console.debug("[auth] login() — calling Firebase signInWithEmailAndPassword")
    let firebaseUser: FirebaseUser

    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email, password)
      firebaseUser = cred.user
      console.debug("[auth] Firebase sign-in successful")
    } catch (err: unknown) {
      // Map Firebase error codes to friendly messages
      const code = (err as { code?: string }).code ?? ""
      console.error("[auth] Firebase sign-in error:", code, err)
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        throw new Error("E-posta veya şifre hatalı.")
      }
      if (code === "auth/too-many-requests") {
        throw new Error("Çok fazla başarısız deneme. Lütfen daha sonra tekrar deneyin.")
      }
      if (code === "auth/user-disabled") {
        throw new Error("Bu hesap devre dışı bırakılmış.")
      }
      if (code === "auth/network-request-failed") {
        throw new Error("Ağ hatası. İnternet bağlantınızı kontrol edin.")
      }
      throw new Error("Giriş yapılamadı. Lütfen tekrar deneyin.")
    }

    try {
      const idToken = await firebaseUser.getIdToken()
      tokenStorage.setToken(idToken)
      console.debug("[auth] ID token stored — fetching /api/v1/me and /permissions/my in parallel")

      const [me, permsData] = await Promise.all([
        apiClient<AuthUser>("/api/v1/me"),
        apiClient<{ permissions: string[] }>("/permissions/my").catch(() => ({ permissions: [] })),
      ])
      _syncRoleCookies(me)
      setUser(me)
      setPermissions(permsData.permissions ?? [])
      console.debug("[auth] Login complete, role:", me.role)
    } catch (err) {
      console.error("[auth] Failed to load user profile after sign-in:", err)
      // Sign out from Firebase so we don't leave a dangling session
      try { await signOut(firebaseAuth) } catch { /* ignore */ }
      tokenStorage.clear()
      _clearRoleCookies()
      throw new Error("Kullanıcı profili yüklenemedi. Lütfen tekrar deneyin.")
    }
  }, [])

  // ── logout ────────────────────────────────────────────────────────────────

  const logout = useCallback(async () => {
    if (MOCK_AUTH) {
      localStorage.removeItem(MOCK_USER_KEY)
      setUser(null)
      _clearRoleCookies()
      return
    }

    console.debug("[auth] logout() — calling Firebase signOut")
    try {
      await signOut(firebaseAuth)
    } catch (err) {
      console.error("[auth] Firebase signOut error:", err)
    }
    tokenStorage.clear()
    _clearRoleCookies()
    setUser(null)
    setPermissions(null)
    console.debug("[auth] Logged out")
  }, [])

  // ── updateUser ────────────────────────────────────────────────────────────

  const updateUser = useCallback((partial: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev
      const updated = { ...prev, ...partial }
      if (MOCK_AUTH) {
        try { localStorage.setItem(MOCK_USER_KEY, JSON.stringify(updated)) } catch { /* ignore */ }
      }
      _syncRoleCookies(updated)
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}