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

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  // `authPermissions` is pre-fetched in parallel with the user profile by
  // AuthProvider, so when it is non-null we skip the redundant API call.
  const { user, permissions: authPermissions } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(!MOCK_AUTH)

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

    try {
      const data = await apiClient<{ permissions: string[] }>("/permissions/my")
      setPermissions((data.permissions ?? []) as Permission[])
    } catch {
      setPermissions([])
    } finally {
      setLoading(false)
    }
  }, [user, authPermissions])

  useEffect(() => {
    if (!MOCK_AUTH) setLoading(true)
    fetchPermissions()
  }, [fetchPermissions])

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