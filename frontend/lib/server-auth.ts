import { cookies } from "next/headers"

export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies()
  if (!cookieStore.has("has_session")) {
    throw new Error("Unauthorized")
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.has("has_session")
}