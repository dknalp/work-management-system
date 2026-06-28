"use client"

import { type Permission } from "@/lib/permissions"
import { usePermissions } from "@/contexts/permissions-context"

export function usePermission(permission: Permission): boolean {
  const { permissions } = usePermissions()
  return permissions.includes(permission)
}