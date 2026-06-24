import { tokenStorage } from "./auth"

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return null

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
    if (!res.ok) {
      tokenStorage.clear()
      return null
    }
    const data = await res.json()
    tokenStorage.setAccess(data.access_token)
    return data.access_token
  } catch {
    tokenStorage.clear()
    return null
  }
}

export async function apiClient<T>(path: string, options: RequestInit = {}): Promise<T> {
  const access = tokenStorage.getAccess()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  }

  if (access) {
    headers["Authorization"] = `Bearer ${access}`
  }

  let res = await fetch(`${API_BASE}${path}`, { ...options, headers })

  if (res.status === 401 && access) {
    // Deduplicate concurrent refresh calls
    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshAccessToken().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }

    const newToken = await refreshPromise
    if (!newToken) {
      window.location.href = "/login"
      throw new Error("Session expired")
    }

    headers["Authorization"] = `Bearer ${newToken}`
    res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  }

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: "Request failed" }))
    throw new Error(error.detail ?? "Request failed")
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const API_BASE_URL = API_BASE