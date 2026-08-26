"use client"

/**
 * Shared admin API helpers, constants, and utilities used across admin section components.
 *
 * All bot management functions call the real backend (/admin/bots/*).
 * Drive connection and storage config functions are placeholders — the
 * corresponding backend endpoints have not yet been implemented.
 */

import { apiClient } from "@/lib/api"

// ---------------------------------------------------------------------------
// Role labels and utilities
// ---------------------------------------------------------------------------

/** Display labels for the three built-in roles. */
export const ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  manager: "Yetkili",
  member: "Üye",
}

/** localStorage key used to persist custom roles in mock-auth mode. */
export const MOCK_CUSTOM_ROLES_KEY = "wms:custom_roles"

/**
 * Return all available roles (built-in + any custom roles persisted in
 * localStorage for mock-auth mode).
 */
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

/**
 * Extract up to two uppercase initials from a display name.
 * Used as a fallback avatar when no image is available.
 */
export function initials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

// ---------------------------------------------------------------------------
// Bot types
// ---------------------------------------------------------------------------

/** A bot account as returned by the backend. */
export interface Bot {
  id: string
  name: string
  description: string | null
  key_prefix: string
  is_active: boolean
  owner_id: string
  created_at: string
  last_used_at: string | null
  /**
   * Present only on the first POST /admin/bots response.
   * Store it immediately — the backend never returns it again.
   */
  full_key?: string
}

// ---------------------------------------------------------------------------
// Bot management — fully wired to backend
// ---------------------------------------------------------------------------

/** Return all bots owned by any user (admin-only endpoint). */
export async function listBots(): Promise<Bot[]> {
  return apiClient.get<Bot[]>("/admin/bots")
}

/**
 * Create a new bot.
 * The returned `Bot` object includes `full_key` exactly once — display it
 * to the admin immediately and do not store it in plaintext.
 */
export async function createBot(name: string, description: string): Promise<Bot> {
  return apiClient.post<Bot>("/admin/bots", { name, description })
}

/** Update a bot's active status or other mutable fields. */
export async function updateBot(
  botId: string,
  patch: Partial<Pick<Bot, "name" | "description" | "is_active">>
): Promise<Bot> {
  return apiClient.patch<Bot>(`/admin/bots/${botId}`, patch)
}

/** Permanently delete a bot. */
export async function deleteBot(botId: string): Promise<void> {
  await apiClient.delete<void>(`/admin/bots/${botId}`)
}

/**
 * Rotate the bot's API key.
 * The returned `Bot` includes the new `full_key` — display and discard the old one.
 */
export async function regenerateBotKey(botId: string): Promise<Bot> {
  return apiClient.post<Bot>(`/admin/bots/${botId}/regenerate-key`)
}

// ---------------------------------------------------------------------------
// Google Drive connection — not yet implemented on the backend
// ---------------------------------------------------------------------------

/** @throws Will throw until the backend Drive status endpoint is implemented. */
export async function getDriveConnectionStatus(): Promise<{ connected: boolean }> {
  throw new Error(
    "Drive connection status endpoint not yet implemented. " +
      "Add GET /api/v1/files/drive/status to the backend."
  )
}

/** @throws Will throw until the backend Drive OAuth endpoint is implemented. */
export async function getConnectDriveUrl(): Promise<{ url: string }> {
  throw new Error(
    "Drive OAuth URL endpoint not yet implemented. " +
      "Add GET /api/v1/files/drive/connect to the backend."
  )
}

/** @throws Will throw until the backend Drive disconnect endpoint is implemented. */
export async function disconnectDrive(): Promise<void> {
  throw new Error(
    "Drive disconnect endpoint not yet implemented. " +
      "Add DELETE /api/v1/files/drive/connection to the backend."
  )
}

// ---------------------------------------------------------------------------
// Storage configuration — not yet implemented on the backend
// ---------------------------------------------------------------------------

/** @throws Will throw until the backend storage config endpoint is implemented. */
export async function getStorageConfig(): Promise<{ path: string; backend: "local" | "r2" }> {
  throw new Error(
    "Storage config endpoint not yet implemented. " +
      "Add GET /admin/storage/config to the backend."
  )
}

/** @throws Will throw until the backend storage path endpoint is implemented. */
export async function updateStoragePath(path: string): Promise<void> {
  void path
  throw new Error(
    "Storage path update endpoint not yet implemented. " +
      "Add PATCH /admin/storage/config to the backend."
  )
}