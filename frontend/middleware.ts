import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const PUBLIC_PATHS = ["/", "/login", "/register", "/forgot-password", "/reset-password"]
const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasSession = request.cookies.get("has_session")?.value === "1"
  const isAdmin = request.cookies.get("is_admin")?.value === "1"

  const isPublic = PUBLIC_PATHS.includes(pathname)
  const isAuthPath = AUTH_PATHS.some((p) => pathname === p || pathname.startsWith(`/(auth)${p}`))

  // Redirect logged-in users away from auth pages
  if (hasSession && isAuthPath) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  // Guard admin routes — redirect non-admins to dashboard
  if (pathname.startsWith("/admin")) {
    if (!hasSession || !isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
    return NextResponse.next()
  }

  // Guard all other protected routes
  if (!isPublic && !isAuthPath && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
}
