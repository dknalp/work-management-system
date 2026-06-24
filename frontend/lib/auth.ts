const ACCESS_KEY = "wos_access_token"
const REFRESH_KEY = "wos_refresh_token"
const SESSION_COOKIE = "has_session"

function syncSessionCookie(set: boolean) {
  if (typeof document === "undefined") return
  if (set) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${7 * 86400}; SameSite=Lax`
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax`
  }
}

export const tokenStorage = {
  setTokens(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
    syncSessionCookie(true)
  },
  setAccess(access: string): void {
    localStorage.setItem(ACCESS_KEY, access)
    syncSessionCookie(true)
  },
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    syncSessionCookie(false)
  },
}

export function decodeJWT(token: string): { sub: string; exp: number; type: string } | null {
  try {
    const payload = token.split(".")[1]
    if (!payload) return null
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")))
    return decoded
  } catch {
    return null
  }
}

export function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token)
  if (!decoded) return true
  return decoded.exp * 1000 < Date.now()
}