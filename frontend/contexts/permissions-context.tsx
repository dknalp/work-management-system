"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { apiClient } from "@/lib/api"
import { MOCK_AUTH, useAuth } from "@/contexts/auth-context"
import { type Permission, type Role, DEFAULT_ROLE_PERMISSIONS } from "@/lib/permissions"

type PermissionsContextValue = {
  permissions: Permission[]
  loading: boolean
  refresh: () => void
}

const PermissionsContext = createContext<PermissionsContextValue | null>(null)

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([])
      setLoading(false)
      return
    }

    if (MOCK_AUTH) {
      const role = (user.role ?? "member") as Role
      setPermissions(DEFAULT_ROLE_PERMISSIONS[role] ?? [])
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
  }, [user])

  useEffect(() => {
    setLoading(true)
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
