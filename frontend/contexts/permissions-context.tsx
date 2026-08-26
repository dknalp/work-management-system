"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { apiClient } from "@/lib/api"
import { MOCK_AUTH, useAuth } from "@/contexts/auth-context"
import { type Permission, DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES } from "@/lib/permissions"

const MOCK_ROLE_PERMISSIONS_KEY = "wms:role_permissions"

type PermissionsContextValue = {
  permissions: Permission[]
  loading: boolean
  refresh: () => void
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

function getMockPermissionsForRole(role: string): Permission[] {
  if (typeof window === "undefined") {
    const sysRole = SYSTEM_ROLES.includes(role as (typeof SYSTEM_ROLES)[number])
      ? (role as (typeof SYSTEM_ROLES)[number])
      : "member"
    return DEFAULT_ROLE_PERMISSIONS[sysRole] ?? []
  }
  try {
    const raw = localStorage.getItem(MOCK_ROLE_PERMISSIONS_KEY)
    if (raw) {
      const stored: Record<string, string[]> = JSON.parse(raw)
      if (stored[role]) return stored[role] as Permission[]
    }
  } catch { /* ignore */ }
  const sysRole = SYSTEM_ROLES.includes(role as (typeof SYSTEM_ROLES)[number])
    ? (role as (typeof SYSTEM_ROLES)[number])
    : "member"
  return DEFAULT_ROLE_PERMISSIONS[sysRole] ?? []
}

/**
 * Derive optimistic permissions from a role string using the static default
 * table. Used to seed the context before the backend responds so the sidebar
 * renders immediately without waiting for the /permissions/my round-trip.
 */
function getOptimisticPermissions(role: string | undefined, isAdmin: boolean | undefined): Permission[] {
  if (isAdmin) return DEFAULT_ROLE_PERMISSIONS["admin"] ?? []
  const sysRole = SYSTEM_ROLES.includes(role as (typeof SYSTEM_ROLES)[number])
    ? (role as (typeof SYSTEM_ROLES)[number])
    : "member"
  return DEFAULT_ROLE_PERMISSIONS[sysRole] ?? []
}

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  // `authPermissions` is pre-fetched in parallel with the user profile by
  // AuthProvider, so when it is non-null we skip the redundant API call.
  const { user, loading: authLoading, permissions: authPermissions } = useAuth()

  // Always start empty to match server-rendered HTML (user is always null on
  // the server). The optimistic-seeding effect below runs immediately after
  // hydration and fills in role-derived permissions before the backend responds,
  // so the sidebar renders with full nav items on the first client paint.
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(false)

  // When auth resolves and we have a user, immediately apply optimistic
  // permissions derived from role — no network call needed for this step.
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPermissions([])
      return
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermissions(getOptimisticPermissions(user.role, user.is_admin))
  }, [authLoading, user?.id, user?.role, user?.is_admin])

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([])
      setLoading(false)
      return
    }

    if (MOCK_AUTH) {
      const role = user.role ?? "member"
      setPermissions(getMockPermissionsForRole(role))
      setLoading(false)
      return
    }

    // Use the permissions already fetched by AuthProvider if available —
    // avoids a second /permissions/my round-trip on every session restore.
    if (authPermissions !== null) {
      setPermissions(authPermissions as Permission[])
      setLoading(false)
      return
    }

    // Silently confirm permissions from backend — UI is already showing
    // optimistic values so no loading spinner is needed.
    try {
      const data = await apiClient<{ permissions: string[] }>("/permissions/my")
      setPermissions((data.permissions ?? []) as Permission[])
    } catch {
      // Keep the optimistic role-derived permissions on error.
    } finally {
      setLoading(false)
    }
  // Depend on user?.id + user?.role (primitive strings) rather than the full
  // user object so Firebase token refreshes — which create a new object reference
  // but don't change identity or role — do not trigger a permissions re-fetch.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role, user?.is_admin, authPermissions])

  useEffect(() => {
    if (authLoading) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPermissions()
  }, [authLoading, fetchPermissions])

  return (
    <PermissionsContext.Provider value={{ permissions, loading, refresh: fetchPermissions }}>
      {children}
    </PermissionsContext.Provider>
  )
}

export function usePermissions(): PermissionsContextValue {
  const ctx = useContext(PermissionsContext)
  if (!ctx) throw new Error("usePermissions must be used within PermissionsProvider")
  return ctx
}