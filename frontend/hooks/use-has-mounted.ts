/**
 * useHasMounted
 *
 * Returns false on the server and during the initial client render (before
 * hydration), and true on every subsequent render.
 *
 * Why this exists:
 * React's hydration requires that the first client-side render produces
 * identical HTML to the server render. Components that read from context,
 * sessionStorage, or any async state will produce different HTML on the server
 * (empty/default) versus the client (real data), causing React error #418.
 *
 * The correct fix for components whose output genuinely differs server vs
 * client is to render a stable skeleton on the first paint and switch to real
 * content after hydration. This hook provides the boolean flag for that guard.
 *
 * Usage:
 *   const mounted = useHasMounted()
 *   if (!mounted) return <Skeleton />   // identical on server and client
 *   return <RealContent />             // only rendered after hydration
 */

import { useEffect, useState } from "react"

export function useHasMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}