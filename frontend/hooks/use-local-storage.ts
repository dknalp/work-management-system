"use client"

/**
 * SSR-safe localStorage hook using useSyncExternalStore.
 *
 * The key insight: Next.js renders components on the server (no localStorage)
 * AND on the client during hydration. If the two renders produce different HTML
 * React throws error #418. useSyncExternalStore solves this by accepting a
 * separate `getServerSnapshot` that always returns the initial value, making
 * the server render deterministic and matching the first client render. The
 * real localStorage value is only read *after* hydration is complete.
 */
import { useCallback, useSyncExternalStore } from "react"

function subscribe(callback: () => void): () => void {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  /** Read the current value from localStorage, falling back to initialValue. */
  const getSnapshot = useCallback((): T => {
    try {
      const item = window.localStorage.getItem(key)
      return item !== null ? (JSON.parse(item) as T) : initialValue
    } catch {
      return initialValue
    }
  }, [key, initialValue])

  /**
   * Server snapshot must match the initial client render to avoid hydration
   * mismatch. Always returns initialValue — localStorage is not available on
   * the server and the first client render must be identical.
   */
  const getServerSnapshot = useCallback((): T => initialValue, [initialValue])

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      try {
        const resolved =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(value)
            : newValue
        window.localStorage.setItem(key, JSON.stringify(resolved))
        // Dispatch a storage event so all tabs and all hook instances with the
        // same key update in sync (the native "storage" event only fires in
        // *other* tabs, so we need to dispatch it manually for the current tab).
        window.dispatchEvent(new Event("storage"))
      } catch {
        // Quota exceeded or private browsing — silent fail.
      }
    },
    [key, value]
  )

  return [value, setValue] as const
}