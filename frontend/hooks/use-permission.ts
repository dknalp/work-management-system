"use client"

import { type Permission } from "@/lib/permissions"
import { usePermissions } from "@/contexts/permissions-context"

/**
 * Returns true when the current user has the given permission.
 *
 * Permissions are seeded optimistically from the user's role before the
 * backend responds, so this hook never returns false during the loading phase
 * — the sidebar and other permission-gated UI render instantly on navigation.
 */
export function usePermission(permission: Permission): boolean {
  const { permissions } = usePermissions()
  return permissions.includes(permission)
}