/**
 * Next.js middleware (named proxy.ts instead of the conventional middleware.ts).
 *
 * Responsibilities:
 *   1. Redirect unauthenticated users who try to access protected routes → /login
 *   2. Redirect authenticated users away from auth pages → /home
 *   3. Redirect the root path for authenticated users → /home
 *
 * What this middleware intentionally does NOT do:
 *   - Enforce role-based access (admin / manager) — that is done server-side
 *     by the backend API and at the page level by useAuth() + usePermissions().
 *     Cookies like ``is_admin`` and ``user_role`` are set by frontend JavaScript
 *     and are therefore not trustworthy for security decisions.  The middleware
 *     only reads the ``has_session`` cookie to determine authentication state;
 *     it does not make authorization decisions.
 *
 * The real authorization boundary is the backend.  Every protected API call
 * requires a valid bearer token that the backend verifies against Firebase Auth.
 */

import { NextRequest, NextResponse } from "next/server"

/** Routes that require the user to be authenticated. */
const PROTECTED_PREFIXES = [
  "/home",
  "/analytics",
  "/board",
  "/tasks",
  "/calendar",
  "/files",
  "/team",
  "/settings",
  "/profile",
  "/admin",
  "/pipelines",
  "/projects",
  "/docs",
  "/agent-builder",
  "/expenses",
]

/** Routes that should redirect authenticated users away (e.g. login page). */
const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"]

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = req.cookies.has("has_session")

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isAuthRoute = AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  // Redirect unauthenticated users to login, preserving the intended destination.
  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  // Redirect already-authenticated users away from auth pages.
  if (isAuthRoute && hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/home"
    url.searchParams.delete("from")
    return NextResponse.redirect(url)
  }

  // Send authenticated users on the root path to the app home.
  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/home", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
}