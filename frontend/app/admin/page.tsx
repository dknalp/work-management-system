"use client"

import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"

import React from "react"
import Link from "next/link"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ActivityIcon,
  ArrowRightIcon,
  BotIcon,
  CheckSquareIcon,
  KeyRoundIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  UsersIcon,
} from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import { AccessDenied } from "@/components/auth/access-denied"
import { useTasks } from "@/contexts/task-context"
import { DriveSection } from "@/components/admin/drive-section"
import { StorageSection } from "@/components/admin/storage-section"
import { UsersSection } from "@/components/admin/users-section"
import { CustomizationSection } from "@/components/admin/customization-section"
import { BotsSection } from "@/components/admin/bots-section"

export default function AdminPage() {
  const { user } = useAuth()
  const canView = usePermission("admin:view") || user?.is_admin
  const { tasks } = useTasks()

  const tasksByStatus = React.useMemo(() => ({
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }), [tasks])

  if (!canView) return (
    <AppShellDynamic>
        <AccessDenied />
</AppShellDynamic>
  )

  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col">
          <Tabs defaultValue="overview" className="flex flex-1 flex-col">

            {/* Tab strip */}
            <div className="border-b border-border/60 px-6 overflow-x-auto">
              <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0">
                {[
                  { value: "overview", label: "Genel Bakış", icon: ActivityIcon },
                  { value: "users", label: "Kullanıcılar", icon: UsersIcon },
                  { value: "integrations", label: "Entegrasyonlar", icon: PlugIcon },
                  { value: "roles", label: "Roller & İzinler", icon: KeyRoundIcon },
                  { value: "customization", label: "Özelleştirme", icon: SlidersHorizontalIcon },
                  { value: "bots", label: "Botlar", icon: BotIcon },
                ].map(({ value, label, icon: Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="relative flex items-center gap-2 rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            {/* ── Genel Bakış ─────────────────────────────────────── */}
            <TabsContent value="overview" className="flex-1 p-6 lg:p-8 space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Toplam Görev", value: tasks.length, icon: CheckSquareIcon, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
                  { label: "Kullanıcılar", value: "—", icon: UsersIcon, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40" },
                  { label: "Devam Ediyor", value: tasksByStatus["in-progress"], icon: ActivityIcon, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40" },
                  { label: "Tamamlandı", value: tasksByStatus.done, icon: CheckSquareIcon, color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">{label}</p>
                      <div className={`flex size-8 items-center justify-center rounded-lg ${color}`}>
                        <Icon className="size-4" />
                      </div>
                    </div>
                    <p className="mt-2 text-3xl font-bold tracking-tight">{value}</p>
                  </div>
                ))}
              </div>

              {/* Recent activity link */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <h2 className="text-sm font-semibold">Son Aktivite</h2>
                  <Link href="/admin/activity" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Tümünü Gör <ArrowRightIcon className="size-3.5" />
                  </Link>
                </div>
                <div className="px-5 py-8 text-center text-sm text-muted-foreground">
                  Aktivite geçmişi için{" "}
                  <Link href="/admin/activity" className="text-primary hover:underline">Admin Aktivite</Link>
                  {" "}sayfasına gidin.
                </div>
              </div>

              {/* Roles quick card */}
              <div className="rounded-xl border border-border/60 bg-card shadow-sm">
                <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                  <h2 className="text-sm font-semibold">Roller & İzinler</h2>
                  <Link href="/admin/roles" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Yönet <ArrowRightIcon className="size-4 text-muted-foreground" />
                  </Link>
                </div>
                <div className="grid gap-3 p-5 sm:grid-cols-3">
                  {[
                    { role: "Yönetici", desc: "Tüm izinlere sahip tam erişim", color: "bg-red-500/10 text-red-600 dark:text-red-400" },
                    { role: "Yetkili", desc: "Görev ve ekip yönetimi yapabilir", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
                    { role: "Üye", desc: "Kendi görevlerini görüntüleyip düzenleyebilir", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
                  ].map(({ role, desc, color }) => (
                    <div key={role} className="rounded-lg border border-border/50 bg-card p-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>{role}</span>
                      <p className="mt-2 text-xs text-muted-foreground">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ── Kullanıcılar ───────────────────────────────────── */}
            <TabsContent value="users" className="flex-1 p-6 lg:p-8">
              <UsersSection />
            </TabsContent>

            {/* ── Entegrasyonlar ─────────────────────────────────── */}
            <TabsContent value="integrations" className="flex-1 p-6 lg:p-8 space-y-6">
              <DriveSection />
              <StorageSection />
            </TabsContent>

            {/* ── Roller & İzinler ───────────────────────────────── */}
            <TabsContent value="roles" className="flex-1 p-6 lg:p-8">
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <KeyRoundIcon className="size-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Rol ve izin yönetimi için{" "}
                  <Link href="/admin/roles" className="text-primary hover:underline">Roller sayfasına</Link>
                  {" "}gidin.
                </p>
              </div>
            </TabsContent>

            {/* ── Özelleştirme ───────────────────────────────────── */}
            <TabsContent value="customization" className="flex-1 p-6 lg:p-8">
              <CustomizationSection />
            </TabsContent>

            {/* ── Botlar ─────────────────────────────────────────── */}
            <TabsContent value="bots" className="flex-1 p-6 lg:p-8">
              <BotsSection />
            </TabsContent>

          </Tabs>
        </main>
      </AppShellDynamic>
  )
}