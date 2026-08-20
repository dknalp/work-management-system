"use client"

// Shared types, constants and utilities used across admin section components.

export const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  manager: "Yetkili",
  member: "Üye",
}

export const MOCK_CUSTOM_ROLES_KEY = "wms:custom_roles"

export function getAllRoles(): { name: string; label: string }[] {
  const base = Object.entries(ROLE_LABELS).map(([name, label]) => ({ name, label }))
  if (typeof window === "undefined") return base
  try {
    const stored = localStorage.getItem(MOCK_CUSTOM_ROLES_KEY)
    const custom: { name: string; label: string }[] = stored ? JSON.parse(stored) : []
    return [...base, ...custom]
  } catch {
    return base
  }
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// Stub async helpers — replace with real implementations when backend is ready
export type DriveConnectionStatus = { connected: boolean; email?: string; connectedAt?: string }
export async function getDriveConnectionStatus(): Promise<DriveConnectionStatus> { return { connected: false } }
export async function getConnectDriveUrl(): Promise<{ url: string }> { throw new Error("not implemented") }
export async function disconnectDrive(): Promise<{ success: boolean }> { return { success: false } }
export async function getStorageConfig(): Promise<{ path: string; source: "env" | "config" | "default" }> { return { path: "/tmp/files", source: "default" } }
export async function updateStoragePath(_path: string): Promise<{ success: boolean; path?: string; error?: string }> { return { success: false, error: "not implemented" } }

export type Bot = { id: string; name: string; description?: string; key_prefix: string; is_active: boolean; last_used_at?: string; api_key?: string }
export async function listBots(): Promise<Bot[]> { return [] }
export async function createBot(_name: string, _desc?: string): Promise<Bot> { throw new Error("not implemented") }
export async function updateBot(_id: string, _data: Partial<Bot>): Promise<Bot> { throw new Error("not implemented") }
export async function deleteBot(_id: string): Promise<void> {}
export async function regenerateBotKey(_id: string): Promise<{ api_key: string }> { throw new Error("not implemented") }