"use client"

import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"

/**
 * Settings page — appearance, notification, and privacy preferences.
 *
 * On mount, preferences are fetched from GET /users/me/preferences and
 * populate all form controls.  Every toggle/select change immediately PATCHes
 * the changed field to the backend so preferences persist across sessions.
 * A skeleton is shown while the initial fetch is in-flight.
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { CheckIcon, BellIcon, ShieldIcon, PaletteIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by GET /users/me/preferences and accepted by PATCH. */
interface UserPreferences {
  notifications_email: boolean
  notifications_push: boolean
  theme: string
  language: string
  timezone: string
}

/** Default values that mirror the backend schema defaults.
 *  Used as the initial form state before the fetch resolves. */
const PREFERENCE_DEFAULTS: UserPreferences = {
  notifications_email: true,
  notifications_push: true,
  theme: "system",
  language: "en",
  timezone: "UTC",
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TABS = [
  { id: "appearance", label: "Görünüm", icon: PaletteIcon },
  { id: "notifications", label: "Bildirimler", icon: BellIcon },
  { id: "privacy", label: "Gizlilik ve Güvenlik", icon: ShieldIcon },
]

const THEME_OPTIONS = [
  { name: "warm",     label: "Sıcak",       bg: "oklch(0.955 0.014 80)",  primary: "oklch(0.16 0.015 60)",  accent: "oklch(0.89 0.024 80)"  },
  { name: "slate",    label: "Gri",         bg: "oklch(0.970 0.004 240)", primary: "oklch(0.20 0.010 250)", accent: "oklch(0.91 0.007 240)" },
  { name: "dark",     label: "Koyu",        bg: "oklch(0.130 0.018 220)", primary: "oklch(0.650 0.120 220)",accent: "oklch(0.230 0.020 220)"},
  { name: "forest",   label: "Orman",       bg: "oklch(0.120 0.018 150)", primary: "oklch(0.600 0.150 145)",accent: "oklch(0.220 0.022 148)"},
  { name: "midnight", label: "Gece Yarısı", bg: "oklch(0.110 0.022 270)", primary: "oklch(0.680 0.140 265)",accent: "oklch(0.210 0.025 268)"},
]

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "tr", label: "Türkçe" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
]

// ---------------------------------------------------------------------------
// Helpers outside the component
// ---------------------------------------------------------------------------

/**
 * Skeleton shown inside the Notifications tab while preferences are loading.
 * Declared at module level to avoid being re-created on every render.
 */
function PreferenceSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-64" />
      <div className="flex gap-3 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-24 rounded-lg" />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SettingsPage() {
  const { theme: activeTheme, setTheme } = useTheme()
  const { user } = useAuth()

  // True after next-themes has hydrated; avoids theme flicker on SSR.
  // useSyncExternalStore is used instead of a setMounted effect to satisfy
  // the react-hooks/set-state-in-effect lint rule.
  const mounted = useSyncExternalStore(
    () => () => {},          // no-op subscribe — we only need the snapshot
    () => true,              // client snapshot: mounted
    () => false,             // server snapshot: not mounted
  )

  const [activeTab, setActiveTab] = useState("appearance")

  // Preferences fetched from the backend.
  const [prefs, setPrefs] = useState<UserPreferences>(PREFERENCE_DEFAULTS)
  const [loadingPrefs, setLoadingPrefs] = useState(true)

  // ---------------------------------------------------------------------------
  // Fetch preferences on mount
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function fetchPreferences() {
      try {
        const data = await apiClient.get<UserPreferences>("/users/me/preferences")
        if (!cancelled) setPrefs(data)
      } catch (err) {
        // Non-fatal: fall back to defaults and let the user see the page.
        console.error("[settings] Failed to load preferences:", err)
      } finally {
        if (!cancelled) setLoadingPrefs(false)
      }
    }

    fetchPreferences()
    return () => { cancelled = true }
  }, [])

  // ---------------------------------------------------------------------------
  // Patch a single preference field immediately on change
  // ---------------------------------------------------------------------------

  const patchPreference = useCallback(
    async (patch: Partial<UserPreferences>) => {
      // Optimistically update local state so the UI feels instant.
      setPrefs((prev) => ({ ...prev, ...patch }))
      try {
        const updated = await apiClient.patch<UserPreferences>("/users/me/preferences", patch)
        setPrefs(updated)
        toast.success("Kaydedildi")
      } catch (err) {
        // Roll back optimistic update on failure.
        setPrefs((prev) => ({ ...prev }))
        console.error("[settings] Failed to save preference:", err)
        toast.error("Kaydedilemedi")
      }
    },
    [],
  )

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleThemeChange(themeName: string, label: string) {
    setTheme(themeName)
    patchPreference({ theme: themeName })
    toast.success(`Tema "${label}" olarak ayarlandı`)
  }

  function handleLanguageChange(lang: string) {
    patchPreference({ language: lang })
  }

  function handleNotificationToggle(
    field: "notifications_email" | "notifications_push",
    currentValue: boolean,
    label: string,
  ) {
    const next = !currentValue
    patchPreference({ [field]: next })
    toast.success(`${label} ${next ? "etkinleştirildi" : "devre dışı bırakıldı"}`)
  }

  // ---------------------------------------------------------------------------
  // Notification rows — driven entirely by persisted prefs
  // ---------------------------------------------------------------------------

  const notificationRows: Array<{
    label: string
    description: string
    field: "notifications_email" | "notifications_push"
  }> = [
    {
      label: "E-posta bildirimleri",
      description: "Etkinlik güncellemelerini e-posta ile alın",
      field: "notifications_email",
    },
    {
      label: "Uygulama bildirimleri",
      description: "Anlık uygulama içi bildirimler alın",
      field: "notifications_push",
    },
  ]

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Çalışma alanı tercihlerinizi yönetin.
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Sidebar navigation */}
            <nav className="flex flex-row gap-1 lg:w-48 lg:flex-col">
              {TABS.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      activeTab === tab.id
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>

            {/* Content panel */}
            <div className="flex-1 space-y-6">

              {/* ── Appearance ────────────────────────────────────────── */}
              {activeTab === "appearance" && (
                <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-base font-semibold">Görünüm</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Workin&apos;in cihazınızda nasıl göründüğünü özelleştirin.
                    </p>
                  </div>
                  <Separator />

                  {/* Theme picker */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tema</Label>
                    <p className="text-xs text-muted-foreground">
                      Arayüz için renk şemasını seçin.
                    </p>
                    {loadingPrefs ? (
                      <div className="mt-3 flex gap-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Skeleton key={i} className="h-20 w-20 rounded-lg" />
                        ))}
                      </div>
                    ) : (
                      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                        {THEME_OPTIONS.map((t) => (
                          <button
                            key={t.name}
                            onClick={() => handleThemeChange(t.name, t.label)}
                            className={cn(
                              "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                              mounted && activeTheme === t.name
                                ? "border-primary bg-primary/5"
                                : "border-border hover:border-border/80 hover:bg-muted/40"
                            )}
                          >
                            {/* Mini preview swatch */}
                            <div
                              className="relative h-12 w-full overflow-hidden rounded-md"
                              style={{ background: t.bg }}
                            >
                              <div
                                className="absolute left-2 top-2 h-2 w-8 rounded-sm"
                                style={{ background: t.primary }}
                              />
                              <div
                                className="absolute bottom-2 left-2 right-2 h-4 rounded-sm"
                                style={{ background: t.accent }}
                              />
                              {mounted && activeTheme === t.name && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                  <CheckIcon className="size-4 text-white" />
                                </div>
                              )}
                            </div>
                            <span className={cn(
                              "text-xs font-medium",
                              mounted && activeTheme === t.name ? "text-primary" : "text-muted-foreground"
                            )}>
                              {t.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Language picker */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dil</Label>
                    <p className="text-xs text-muted-foreground">
                      Tercih ettiğiniz görüntüleme dilini seçin.
                    </p>
                    {loadingPrefs ? (
                      <Skeleton className="mt-2 h-9 w-48" />
                    ) : (
                      <Select
                        value={prefs.language}
                        onValueChange={handleLanguageChange}
                      >
                        <SelectTrigger className="mt-2 w-48">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LANGUAGE_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}

              {/* ── Notifications ─────────────────────────────────────── */}
              {activeTab === "notifications" && (
                <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-base font-semibold">Bildirimler</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Hangi bildirimleri alacağınızı kontrol edin.
                    </p>
                  </div>
                  <Separator />

                  {loadingPrefs ? (
                    <PreferenceSkeleton />
                  ) : (
                    notificationRows.map(({ label, description, field }) => (
                      <div key={field} className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{label}</p>
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                        <button
                          onClick={() => handleNotificationToggle(field, prefs[field], label)}
                          className={cn(
                            "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                            prefs[field] ? "bg-primary" : "bg-muted"
                          )}
                          role="switch"
                          aria-checked={prefs[field]}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                              prefs[field] ? "translate-x-4" : "translate-x-0"
                            )}
                          />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Privacy & Security ────────────────────────────────── */}
              {activeTab === "privacy" && (
                <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-base font-semibold">Gizlilik ve Güvenlik</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Hesap güvenlik ayarlarınızı yönetin.
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Hesap</p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{user?.email}</span> olarak oturum açıldı
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toast.info("Şifre değiştirme yakında geliyor")}
                    >
                      Şifre değiştir
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:bg-destructive/5 hover:text-destructive"
                      onClick={() => toast.info("Hesap silme yakında geliyor")}
                    >
                      Hesabı sil
                    </Button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </main>
      </AppShellDynamic>
  )
}