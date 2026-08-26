"use client"

/**
 * AppShell — the authenticated app layout shell.
 *
 * Wraps SidebarProvider + AppSidebar + SidebarInset + SiteHeader into a single
 * reusable component.  Pages import this via AppShellDynamic (ssr: false) so
 * the entire shell — including all sidebar nav items, user data, permission
 * checks, and project lists — is excluded from server-side rendering.
 *
 * Why ssr: false?
 * Every sidebar nav item, project list, user avatar, and notification badge is
 * derived from client-only state (Firebase auth, context caches, sessionStorage).
 * When Next.js renders these server-side it produces empty/default HTML that
 * never matches what React renders on the client → React error #418.  Excluding
 * the shell from SSR eliminates all structural mismatches at once.
 */

import React from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const SIDEBAR_STYLE = {
  "--sidebar-width": "calc(var(--spacing) * 64)",
  "--header-height": "calc(var(--spacing) * 14)",
} as React.CSSProperties

interface AppShellProps {
  children: React.ReactNode
}

/** Full authenticated layout: sidebar + header + main content area. */
export function AppShell({ children }: AppShellProps) {
  return (
    <SidebarProvider style={SIDEBAR_STYLE}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        {children}
      </SidebarInset>
    </SidebarProvider>
  )
}