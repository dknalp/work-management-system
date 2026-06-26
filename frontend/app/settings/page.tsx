"use client"

import { useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
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
import { toast } from "sonner"
import { CheckIcon, BellIcon, ShieldIcon, PaletteIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const TABS = [
  { id: "appearance", label: "Görünüm", icon: PaletteIcon },
  { id: "notifications", label: "Bildirimler", icon: BellIcon },
  { id: "privacy", label: "Gizlilik ve Güvenlik", icon: ShieldIcon },
]

export default function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState("appearance")
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [taskReminders, setTaskReminders] = useState(true)
  const [teamUpdates, setTeamUpdates] = useState(false)

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Ayarlar</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Çalışma alanı tercihlerinizi yönetin.
            </p>
          </div>

          <div className="flex flex-col gap-6 lg:flex-row">
            {/* Sidebar nav */}
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

            {/* Content */}
            <div className="flex-1 space-y-6">
              {activeTab === "appearance" && (
                <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-base font-semibold">Görünüm</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      WorkOS'un cihazınızda nasıl göründüğünü özelleştirin.
                    </p>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Tema</Label>
                    <p className="text-xs text-muted-foreground">
                      Arayüz için renk şemasını seçin.
                    </p>
                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {[
                        { name: "warm",     label: "Sıcak",      bg: "oklch(0.955 0.014 80)",  primary: "oklch(0.16 0.015 60)",  accent: "oklch(0.89 0.024 80)"  },
                        { name: "slate",    label: "Gri",        bg: "oklch(0.970 0.004 240)", primary: "oklch(0.20 0.010 250)", accent: "oklch(0.91 0.007 240)" },
                        { name: "dark",     label: "Koyu",       bg: "oklch(0.130 0.018 220)", primary: "oklch(0.650 0.120 220)",accent: "oklch(0.230 0.020 220)"},
                        { name: "forest",   label: "Orman",      bg: "oklch(0.120 0.018 150)", primary: "oklch(0.600 0.150 145)",accent: "oklch(0.220 0.022 148)"},
                        { name: "midnight", label: "Gece Yarısı",bg: "oklch(0.110 0.022 270)", primary: "oklch(0.680 0.140 265)",accent: "oklch(0.210 0.025 268)"},
                      ].map((t) => (
                        <button
                          key={t.name}
                          onClick={() => { setTheme(t.name); toast.success(`Theme set to ${t.label}`) }}
                          className={cn(
                            "flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all",
                            theme === t.name
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-border/80 hover:bg-muted/40"
                          )}
                        >
                          <div
                            className="relative flex h-10 w-full items-center justify-center gap-1 rounded-md border border-black/10"
                            style={{ backgroundColor: t.bg }}
                          >
                            <div className="size-3 rounded-full" style={{ backgroundColor: t.primary }} />
                            <div className="size-2 rounded-full opacity-60" style={{ backgroundColor: t.accent }} />
                            {theme === t.name && (
                              <div className="absolute right-1 top-1">
                                <CheckIcon className="size-3" style={{ color: t.primary }} />
                              </div>
                            )}
                          </div>
                          <span className={cn("text-xs font-medium", theme === t.name ? "text-primary" : "text-muted-foreground")}>
                            {t.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Dil</Label>
                    <p className="text-xs text-muted-foreground">
                      Tercih ettiğiniz görüntüleme dilini seçin.
                    </p>
                    <Select defaultValue="en">
                      <SelectTrigger className="mt-2 w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="tr">Türkçe</SelectItem>
                        <SelectItem value="de">Deutsch</SelectItem>
                        <SelectItem value="fr">Français</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {activeTab === "notifications" && (
                <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="text-base font-semibold">Bildirimler</h2>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Hangi bildirimleri alacağınızı kontrol edin.
                    </p>
                  </div>
                  <Separator />
                  {[
                    { label: "E-posta bildirimleri", description: "Etkinlik güncellemelerini e-posta ile alın", value: emailNotifs, onChange: setEmailNotifs },
                    { label: "Görev hatırlatıcıları", description: "Yaklaşan son tarihler için hatırlatıcı alın", value: taskReminders, onChange: setTaskReminders },
                    { label: "Ekip güncellemeleri", description: "Ekip üyeleri eklendiğinde veya kaldırıldığında bildirim alın", value: teamUpdates, onChange: setTeamUpdates },
                  ].map(({ label, description, value, onChange }) => (
                    <div key={label} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">{description}</p>
                      </div>
                      <button
                        onClick={() => { onChange(!value); toast.success(`${label} ${!value ? "enabled" : "disabled"}`) }}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
                          value ? "bg-primary" : "bg-muted"
                        )}
                        role="switch"
                        aria-checked={value}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
                            value ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}

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
                    <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{user?.email}</span> olarak oturum açıldı</p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => toast.info("Şifre değiştirme yakında geliyor")}>
                      Şifre değiştir
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/5 hover:text-destructive" onClick={() => toast.info("Hesap silme yakında geliyor")}>
                      Hesabı sil
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}