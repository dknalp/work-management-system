import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/layout/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AuthProvider } from "@/contexts/auth-context"
import { PermissionsProvider } from "@/contexts/permissions-context"
import { TaskProvider } from "@/contexts/task-context"
import { CommandPalette } from "@/components/command-palette"
import { TeamProvider } from "@/contexts/team-context"
import { cn } from "@/lib/utils"
import { ChatWidgetWrapper } from "@/components/chat-widget-wrapper"
import { Toaster } from "@/components/ui/sonner"

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" })

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "antialiased",
        fontMono.variable,
        geist.variable,
        instrumentSerif.variable,
        "font-sans"
      )}
    >
      <body>
        <ThemeProvider>
          <AuthProvider><PermissionsProvider><TaskProvider><TeamProvider><CommandPalette />
            <TooltipProvider>{children}<ChatWidgetWrapper /></TooltipProvider>
            <Toaster />
          </TeamProvider></TaskProvider></PermissionsProvider></AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
