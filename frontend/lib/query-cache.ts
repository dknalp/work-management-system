/**
 * query-cache.ts
 *
 * Thin sessionStorage-backed cache for API responses.
 *
 * Purpose: implement a stale-while-revalidate pattern for global contexts so
 * that navigating to a previously-visited page renders instantly from cache
 * instead of showing a loading spinner while the network request completes.
 *
 * - TTL defaults to 5 minutes. Data older than that is treated as a miss so
 *   the next mount triggers a fresh fetch.
 * - sessionStorage is cleared on browser close / hard refresh, so stale data
 *   never survives across sessions.
 * - All keys are prefixed with "wms:cache:" to avoid collisions.
 */

const KEY_PREFIX = "wms:cache:"
const DEFAULT_TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  data: T
  /** Unix timestamp (ms) after which this entry is considered stale. */
  expiresAt: number
}

/**
 * Read a cached value. Returns `null` when the key is missing, unreadable,
 * or older than its TTL.
 */
export function cacheGet<T>(key: string): T | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(KEY_PREFIX + key)
    if (!raw) return null
    const entry: CacheEntry<T> = JSON.parse(raw)
    if (Date.now() > entry.expiresAt) {
      sessionStorage.removeItem(KEY_PREFIX + key)
      return null
    }
    return entry.data
  } catch {
    return null
  }
}

/**
 * Write a value to the cache with an optional TTL (defaults to 5 minutes).
 * Silently ignores storage quota errors — the app still works, just slower.
 */
export function cacheSet<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS): void {
  if (typeof window === "undefined") return
  try {
    const entry: CacheEntry<T> = { data, expiresAt: Date.now() + ttlMs }
    sessionStorage.setItem(KEY_PREFIX + key, JSON.stringify(entry))
  } catch {
    // SessionStorage quota exceeded — degrade gracefully (no caching).
  }
}

/**
 * Remove a single cache entry. Call this after a successful write operation
 * so the next context mount fetches fresh data from the backend.
 */
export function cacheInvalidate(key: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(KEY_PREFIX + key)
  } catch {
    // ignore
  }
}

/**
 * Remove all cache entries written by this module (keys prefixed with
 * "wms:cache:"). Call on logout so the next user gets a clean slate.
 */
export function cacheInvalidateAll(): void {
  if (typeof window === "undefined") return
  try {
    const toDelete: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i)
      if (k?.startsWith(KEY_PREFIX)) toDelete.push(k)
    }
    toDelete.forEach((k) => sessionStorage.removeItem(k))
  } catch {
    // ignore
  }
}