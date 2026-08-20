"use client"

import Link from "next/link"
import { useState } from "react"
import { BriefcaseIcon, BookOpenIcon, ChevronRightIcon, ExternalLinkIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { DocsContent } from "@/components/docs/docs-content"

const NAV_SECTIONS = [
  { id: "getting-started", label: "Başlangıç" },
  { id: "authentication", label: "Authentication" },
  { id: "me", label: "Me" },
  { id: "tasks", label: "Tasks" },
  { id: "team", label: "Team" },
  { id: "activity", label: "Activity" },
  { id: "analytics", label: "Analytics" },
  { id: "files", label: "Files" },
  { id: "messages", label: "Messages" },
  { id: "webhooks", label: "Webhooks" },
  { id: "webhook-events", label: "Webhook Events" },
  { id: "examples", label: "Örnekler" },
]

export default function DocsPage() {
  const [active, setActive] = useState("getting-started")

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar nav */}
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border/50 bg-card lg:flex">
        <div className="flex items-center gap-2 border-b border-border/50 px-4 py-4">
          <div className="flex size-6 items-center justify-center rounded bg-primary text-primary-foreground">
            <BriefcaseIcon className="size-3.5" />
          </div>
          <span className="text-sm font-semibold">WorkSync API</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={() => setActive(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                active === s.id
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <ChevronRightIcon className="size-3 shrink-0 opacity-50" />
              {s.label}
            </a>
          ))}
        </nav>
        <div className="border-t border-border/50 p-3">
          <Link
            href="/analytics"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLinkIcon className="size-3" /> Uygulamaya Dön
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0">
        <header className="sticky top-0 z-10 border-b border-border/50 bg-background/80 backdrop-blur-sm px-6 py-3 flex items-center gap-3">
          <BookOpenIcon className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">API Dokümantasyonu</span>
          <span className="ml-auto rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            v1
          </span>
        </header>

        <div className="mx-auto max-w-4xl px-6 pb-24 pt-8">
          {/* Hero */}
          <div className="mb-10 rounded-2xl border border-border/40 bg-gradient-to-br from-primary/5 to-transparent p-8">
            <h1 className="text-3xl font-bold tracking-tight">WorkSync API</h1>
            <p className="mt-2 text-muted-foreground">
              Gerçek kullanıcının yapabildiği her şeyi botlar da bu API aracılığıyla yapabilir —
              görev yönetimi, ekip okuma, dosya işlemleri, analytics ve webhook entegrasyonu.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border/50 bg-muted/50 px-3 py-1">REST JSON</span>
              <span className="rounded-full border border-border/50 bg-muted/50 px-3 py-1">Bearer Token Auth</span>
              <span className="rounded-full border border-border/50 bg-muted/50 px-3 py-1">Webhook Support</span>
            </div>
            <div className="mt-5 flex items-center gap-3">
              <Link
                href="/admin?tab=bots"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Bot Hesabı Oluştur →
              </Link>
              <span className="text-xs text-muted-foreground">Admin yetkisi gerektirir</span>
            </div>
          </div>

          {/* All API sections */}
          <DocsContent />
        </div>
      </main>
    </div>
  )
}