/**
 * Token storage helpers for the Firebase ID token.
 *
 * The Firebase ID token (a JWT issued by Firebase Auth) is stored in
 * localStorage under `wms_id_token` and synced to a `has_session` cookie
 * that the Next.js middleware reads to gate protected routes.
 *
 * The `is_admin` and `user_role` cookies are written by `auth-context.tsx`
 * after a successful `/users/me` response — they are not managed here.
 */

const TOKEN_KEY = "wms_id_token"
const SESSION_COOKIE = "has_session"

/** Write or clear the `has_session` cookie read by proxy.ts middleware. */
function syncSessionCookie(set: boolean): void {
  if (typeof document === "undefined") return
  if (set) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; max-age=${7 * 86400}; SameSite=Lax; Secure`
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0; SameSite=Lax; Secure`
  }
}

export const tokenStorage = {
  /** Persist a Firebase ID token and mark the session as active. */
  setToken(idToken: string): void {
    if (typeof localStorage === "undefined") return
    localStorage.setItem(TOKEN_KEY, idToken)
    syncSessionCookie(true)
  },

  /** Return the stored Firebase ID token, or null if not signed in. */
  getToken(): string | null {
    if (typeof localStorage === "undefined") return null
    return localStorage.getItem(TOKEN_KEY)
  },

  /**
   * Alias for `getToken()` — kept for backwards compatibility with components
   * that were written against the old JWT-based `tokenStorage.getAccess()` API.
   */
  getAccess(): string | null {
    return this.getToken()
  },

  /** Remove the token and clear the session cookie (logout). */
  clear(): void {
    if (typeof localStorage === "undefined") return
    localStorage.removeItem(TOKEN_KEY)
    syncSessionCookie(false)
    // Also clear admin/role cookies written by auth-context
    document.cookie = "is_admin=; path=/; max-age=0; SameSite=Lax; Secure"
    document.cookie = "user_role=; path=/; max-age=0; SameSite=Lax; Secure"
  },
}