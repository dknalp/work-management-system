"use client"

import React from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { useTheme } from "next-themes"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const THEMES = [
  {
    name: "warm",
    label: "Warm",
    description: "Krem beyaz, sıcak ve göz dostu aydınlık tema",
    bg: "oklch(0.955 0.014 80)",
    primary: "oklch(0.16 0.015 60)",
    accent: "oklch(0.89 0.024 80)",
  },
  {
    name: "slate",
    label: "Slate",
    description: "Serin gri-mavi, Linear tarzı aydınlık tema",
    bg: "oklch(0.970 0.004 240)",
    primary: "oklch(0.20 0.010 250)",
    accent: "oklch(0.91 0.007 240)",
  },
  {
    name: "dark",
    label: "Dark",
    description: "Nötr koyu karbon tonu, göz yormayan karanlık",
    bg: "oklch(0.130 0.018 220)",
    primary: "oklch(0.650 0.120 220)",
    accent: "oklch(0.230 0.020 220)",
  },
  {
    name: "forest",
    label: "Forest",
    description: "Koyu orman yeşili, developer dostu gece teması",
    bg: "oklch(0.120 0.018 150)",
    primary: "oklch(0.600 0.150 145)",
    accent: "oklch(0.220 0.022 148)",
  },
  {
    name: "midnight",
    label: "Midnight",
    description: "Derin lacivert, konsantre çalışma için gece teması",
    bg: "oklch(0.110 0.022 270)",
    primary: "oklch(0.680 0.140 265)",
    accent: "oklch(0.210 0.025 268)",
  },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col overflow-auto bg-background/50">
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 md:px-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="text-sm text-muted-foreground">
                Uygulama görünüm tercihlerinizi yönetin.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1 border-b border-border pb-4">
                <h2 className="text-base font-semibold">Appearance</h2>
                <p className="text-sm text-muted-foreground">
                  Tema seçiminiz tarayıcınızda kalıcı olarak saklanır. <kbd className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">D</kbd> tuşu ile de hızlıca aydınlık/karanlık geçişi yapabilirsiniz.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {THEMES.map((t) => {
                  const isActive = theme === t.name
                  return (
                    <button
                      key={t.name}
                      onClick={() => setTheme(t.name)}
                      className={cn(
                        "group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all",
                        isActive
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:border-primary/40 hover:bg-accent/30"
                      )}
                    >
                      <div
                        className="flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-lg border border-black/5"
                        style={{ backgroundColor: t.bg }}
                      >
                        <div
                          className="size-6 rounded-full shadow-sm"
                          style={{ backgroundColor: t.primary }}
                        />
                        <div
                          className="size-4 rounded-full opacity-60"
                          style={{ backgroundColor: t.accent }}
                        />
                        <div
                          className="size-3 rounded-full opacity-30"
                          style={{ backgroundColor: t.primary }}
                        />
                      </div>

                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold">{t.label}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                            {t.description}
                          </p>
                        </div>
                        {isActive && (
                          <div className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary">
                            <CheckIcon className="size-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}