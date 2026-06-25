"use client"

import { usePathname } from "next/navigation"
import { ChatWidget } from "@/components/chat-widget"

const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password"]

export function ChatWidgetWrapper() {
  const pathname = usePathname()
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) return null
  return <ChatWidget />
}