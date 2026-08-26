"use client"
/**
 * AppShellDynamic — SSR-disabled version of AppShell.
 *
 * All authenticated pages import this instead of using SidebarProvider +
 * AppSidebar + SiteHeader directly.  The `ssr: false` flag means Next.js
 * never renders the sidebar, nav items, user data, or permission-gated links
 * on the server, eliminating all sources of React hydration error #418 that
 * originate from client-only context values (auth, permissions, projects,
 * notifications) differing between server and client renders.
 */
import dynamic from "next/dynamic"

export const AppShellDynamic = dynamic(
  () => import("./app-shell").then((m) => m.AppShell),
  { ssr: false }
)