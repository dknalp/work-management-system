import { NextRequest, NextResponse } from "next/server"
import { exchangeCodeForTokens } from "@/lib/google-oauth"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin?drive_error=${encodeURIComponent(error)}`, req.url)
    )
  }

  if (!code) {
    return NextResponse.redirect(new URL("/admin?drive_error=no_code", req.url))
  }

  try {
    await exchangeCodeForTokens(code)
    return NextResponse.redirect(new URL("/admin?drive_connected=1", req.url))
  } catch (err) {
    console.error("Drive OAuth callback error:", err)
    const msg = err instanceof Error ? err.message : "Bilinmeyen hata"
    return NextResponse.redirect(
      new URL(`/admin?drive_error=${encodeURIComponent(msg)}`, req.url)
    )
  }
}