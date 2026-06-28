"use client"

import { type Permission } from "@/lib/permissions"
import { usePermissions } from "@/contexts/permissions-context"

type PermissionGateProps = {
  permission: Permission
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const { permissions, loading } = usePermissions()
  if (loading) return null
  if (!permissions.includes(permission)) return <>{fallback}</>
  return <>{children}</>
}