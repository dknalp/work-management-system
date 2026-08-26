/**
 * ClientOnly
 *
 * Renders `children` only after the component has mounted on the client.
 * During SSR and the initial client render (hydration pass), renders
 * `fallback` instead (defaults to null).
 *
 * Why this exists:
 * Components that read from React context, sessionStorage, or any async
 * state produce different HTML on the server (empty/default values) vs the
 * client (real data from cache or a fast context resolve). This structural
 * mismatch triggers React error #418, which causes a full component-tree
 * remount and the visible "flash" where everything appears blank then
 * repaints.
 *
 * The correct fix for these components is to skip server rendering
 * entirely and render a stable fallback (skeleton or null) until
 * hydration is complete.
 *
 * Usage:
 *   <ClientOnly fallback={<Skeleton />}>
 *     <DynamicComponent />
 *   </ClientOnly>
 */

"use client"

import { useHasMounted } from "@/hooks/use-has-mounted"

interface ClientOnlyProps {
  children: React.ReactNode
  /** Rendered on the server and during the first client paint. Defaults to null. */
  fallback?: React.ReactNode
}

export function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const mounted = useHasMounted()
  if (!mounted) return <>{fallback}</>
  return <>{children}</>
}