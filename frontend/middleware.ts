import { NextRequest, NextResponse } from "next/server"

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/tasks",
  "/calendar",
  "/files",
  "/team",
  "/settings",
  "/profile",
  "/admin",
]

const AUTH_ROUTES = ["/login", "/forgot-password", "/reset-password"]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const hasSession = req.cookies.has("has_session")

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isAuthRoute = AUTH_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/dashboard"
    url.searchParams.delete("from")
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
}
