import { NextRequest, NextResponse } from "next/server"

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
  "/expenses",
]

/** Routes that require admin or manager role. Members are redirected to /home. */
const ADMIN_OR_MANAGER_ROUTES = ["/expenses"]

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

  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/")
  const isAdminCookie = req.cookies.get("is_admin")?.value === "1"
  const userRole = req.cookies.get("user_role")?.value
  const isAdminRole = isAdminCookie || userRole === "admin"

  if (isAdminRoute && hasSession && !isAdminRole) {
    return NextResponse.redirect(new URL("/home", req.url))
  }

  const isAdminOrManagerRoute = ADMIN_OR_MANAGER_ROUTES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )
  const isManagerRole = userRole === "manager"
  if (isAdminOrManagerRoute && hasSession && !isAdminRole && !isManagerRole) {
    return NextResponse.redirect(new URL("/home", req.url))
  }

  if (isProtected && !hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("from", pathname)
    return NextResponse.redirect(url)
  }

  if (isAuthRoute && hasSession) {
    const url = req.nextUrl.clone()
    url.pathname = "/home"
    url.searchParams.delete("from")
    return NextResponse.redirect(url)
  }

  if (pathname === "/" && hasSession) {
    return NextResponse.redirect(new URL("/home", req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico).*)"],
}