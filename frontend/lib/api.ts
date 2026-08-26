/**
 * Typed API client for the work-management-system backend.
 *
 * Reads the Firebase ID token from localStorage on every request.
 * On a 401, forces a Firebase token refresh (the SDK re-fetches from
 * Firebase servers) and retries the request once before redirecting to /login.
 *
 * Usage:
 *   import { apiClient } from "@/lib/api"
 *   const tasks = await apiClient<Task[]>("/tasks")
 */

import { tokenStorage } from "./auth"
import { firebaseAuth } from "./firebase"

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3052").replace(/\/+$/, "")

/** Force-refresh the Firebase ID token and persist the new value. */
async function refreshFirebaseToken(): Promise<string | null> {
  try {
    const user = firebaseAuth.currentUser
    if (!user) {
      console.warn("[api] refreshFirebaseToken: no current Firebase user")
      tokenStorage.clear()
      return null
    }
    const newToken = await user.getIdToken(/* forceRefresh= */ true)
    tokenStorage.setToken(newToken)
    console.debug("[api] Firebase ID token refreshed")
    return newToken
  } catch (err) {
    console.error("[api] Failed to refresh Firebase ID token:", err)
    tokenStorage.clear()
    return null
  }
}

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = tokenStorage.getToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  } else {
    console.debug(`[api] No token stored — sending unauthenticated request to ${path}`)
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  // On 401, try a single token refresh and retry
  if (res.status === 401 && token) {
    console.warn(`[api] 401 on ${path} — attempting token refresh`)
    const newToken = await refreshFirebaseToken()
    if (!newToken) {
      console.error("[api] Token refresh failed — redirecting to /login")
      if (typeof window !== "undefined") window.location.href = "/login"
      throw new Error("Session expired. Please log in again.")
    }
    headers["Authorization"] = `Bearer ${newToken}`
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: "Request failed" }))
    const message = errorBody.detail ?? "Request failed"
    console.error(`[api] ${res.status} ${res.statusText} on ${path}:`, message)
    throw new Error(message)
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const API_BASE_URL = API_BASE

// ---------------------------------------------------------------------------
// Convenience method wrappers (backwards-compatible with the old api client)
// ---------------------------------------------------------------------------

apiClient.get = <T>(path: string) => apiClient<T>(path)

apiClient.post = <T>(path: string, body?: unknown) =>
  apiClient<T>(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

apiClient.put = <T>(path: string, body?: unknown) =>
  apiClient<T>(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

apiClient.patch = <T>(path: string, body?: unknown) =>
  apiClient<T>(path, {
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

apiClient.delete = <T>(path: string, body?: unknown) =>
  apiClient<T>(path, {
    method: "DELETE",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })