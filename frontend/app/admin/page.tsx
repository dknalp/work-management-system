"use client"

import React from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth, type User } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useTasks } from "@/contexts/task-context"
import { toast } from "sonner"
import {
  ShieldIcon,
  UsersIcon,
  CheckSquareIcon,
  ActivityIcon,
  HardDriveIcon,
  InfoIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  UnlinkIcon,
  XCircleIcon,
  PlusIcon,
} from "lucide-react"
import { redirect, useSearchParams } from "next/navigation"
import { getStorageConfig, updateStoragePath } from "@/lib/actions/files"
import { getDriveConnectionStatus, getConnectDriveUrl, disconnectDrive, type DriveConnectionStatus } from "@/lib/actions/drive"
import { Input } from "@/components/ui/input"

const ROLE_LABELS: Record<"admin" | "manager" | "member", string> = {
  admin: "Yönetici",
  manager: "Yetkili",
  member: "Üye",
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
}

function DriveSection() {
  const searchParams = useSearchParams()
  const [status, setStatus] = React.useState<DriveConnectionStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [banner, setBanner] = React.useState<{ type: "success" | "error"; msg: string } | null>(null)

  React.useEffect(() => {
    getDriveConnectionStatus().then((s) => { setStatus(s); setLoadingStatus(false) })
  }, [])

  React.useEffect(() => {
    if (searchParams.get("drive_connected") === "1") {
      setBanner({ type: "success", msg: "Google Drive başarıyla bağlandı." })
      getDriveConnectionStatus().then(setStatus)
    }
    const err = searchParams.get("drive_error")
    if (err) setBanner({ type: "error", msg: `Bağlantı hatası: ${err}` })
  }, [searchParams])

  async function handleConnect() {
    setActionLoading(true)
    try {
      const { url } = await getConnectDriveUrl()
      window.location.href = url
    } catch (e) {
      const msg = e instanceof Error && e.message.includes("GOOGLE_CLIENT_ID")
        ? "GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET tanımlanmamış. .env.local dosyasına ekleyin."
        : "Bağlantı kurulamadı. Lütfen tekrar deneyin."
      setBanner({ type: "error", msg })
      setActionLoading(false)
    }
  }

  async function handleDisconnect() {
    setActionLoading(true)
    const res = await disconnectDrive()
    if (res.success) {
      setStatus({ connected: false })
      setBanner({ type: "success", msg: "Google Drive bağlantısı kesildi." })
    }
    setActionLoading(false)
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
          <svg viewBox="0 0 24 24" className="size-4 text-blue-500" fill="currentColor">
            <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Google Drive Entegrasyonu</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Şirket Drive hesabını tüm çalışanlarla paylaşın</p>
        </div>
        <div className="ml-auto">
          {loadingStatus ? (
            <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          ) : status?.connected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle2Icon className="size-3.5" /> Bağlı
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <XCircleIcon className="size-3.5" /> Bağlı Değil
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {banner && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${banner.type === "success" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}>
            {banner.type === "success" ? <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" /> : <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />}
            <span>{banner.msg}</span>
            <button className="ml-auto" onClick={() => setBanner(null)}>✕</button>
          </div>
        )}

        {status?.connected ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hesap</span>
                <span className="font-medium">{status.email}</span>
              </div>
              {status.connectedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bağlantı tarihi</span>
                  <span className="text-muted-foreground">{new Date(status.connectedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <a href="/files/drive" target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="size-3.5" /> Dosyaları Görüntüle
                </a>
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleDisconnect} disabled={actionLoading}>
                <UnlinkIcon className="size-3.5" />
                {actionLoading ? "Kesiliyor…" : "Bağlantıyı Kes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button className="gap-2" onClick={handleConnect} disabled={actionLoading}>
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
              </svg>
              {actionLoading ? "Yönlendiriliyor…" : "Google hesabıyla bağlan"}
            </Button>
            <p className="text-xs text-muted-foreground">Google hesabınıza yönlendirileceksiniz.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StorageSection() {
  const [storagePath, setStoragePath] = React.useState("")
  const [source, setSource] = React.useState<"env" | "config" | "default">("default")
  const [pathInput, setPathInput] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    getStorageConfig().then(({ path, source }: { path: string; source: "env" | "config" | "default" }) => {
      setStoragePath(path)
      setSource(source)
      setPathInput(path)
    })
  }, [])

  const handleSave = async () => {
    if (!pathInput.trim()) return
    setSaving(true)
    const res = await updateStoragePath(pathInput.trim())
    if (res.success) {
      setStoragePath(res.path ?? pathInput.trim())
      setSource("config")
      toast.success("Depolama yolu güncellendi")
    } else {
      toast.error(res.error ?? "Failed to update storage path")
    }
    setSaving(false)
  }

  const sourceLabel = {
    env: { text: "Ortam Değişkeni", color: "text-violet-500 bg-violet-500/10" },
    config: { text: "Özel Yapılandırma", color: "text-emerald-500 bg-emerald-500/10" },
    default: { text: "Varsayılan", color: "text-muted-foreground bg-muted/60" },
  }[source]

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HardDriveIcon className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Depolama Yapılandırması</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dosyaların diskte saklandığı yer. Paylaşılan bir ağ sürücüsüne yönlendirmek için değiştirin.
          </p>
        </div>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceLabel.color}`}>
          {sourceLabel.text}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mevcut Yol</p>
          <p className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-sm break-all">{storagePath || "Yükleniyor…"}</p>
        </div>

        {source === "env" ? (
          <div className="flex items-start gap-2 rounded-lg bg-violet-500/5 border border-violet-500/20 px-3 py-2.5">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-violet-500" />
            <p className="text-xs text-muted-foreground">
              Yol, <code className="font-mono text-xs text-violet-500">FILE_STORAGE_PATH</code> ortam değişkeni tarafından kontrol edilmektedir ve buradan değiştirilemez.
              UI yapılandırmasını etkinleştirmek için ortam değişkenini kaldırın.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Özel Yol Ayarla</p>
            <div className="flex gap-2">
              <Input
                placeholder="/absolute/path/to/storage"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                className="font-mono text-sm"
              />
              <Button onClick={handleSave} disabled={saving || !pathInput.trim() || pathInput === storagePath} size="sm" className="shrink-0">
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Çok sunuculu kurulumlar için bunun yerine <code className="font-mono text-xs">FILE_STORAGE_PATH</code> ortam değişkenini ayarlayın — bu ayarın önüne geçer ve diske kaydedilmeden hemen uygulanır.
                Dizin mevcut değilse oluşturulacaktır.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-amber-600 dark:text-amber-400">Container uyarısı:</span>{" "}
                Bu yapılandırma <code className="font-mono text-xs">config/storage.json</code> dosyasına kaydedilir ve container yeniden başlatıldığında sıfırlanır.
                Kalıcı bir depolama yolu için <code className="font-mono text-xs">FILE_STORAGE_PATH</code> ortam değişkenini kullanın.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "member" as "admin" | "manager" | "member" }

function UsersSection() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = React.useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [creating, setCreating] = React.useState(false)

  React.useEffect(() => {
    apiClient<User[]>("/admin/users")
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoadingUsers(false))
  }, [])

  const handleRoleChange = async (u: User, role: "admin" | "manager" | "member") => {
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role, is_admin: role === "admin" } : x)))
    try {
      await apiClient(`/admin/users/${u.id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      })
      toast.success(`${u.name}'ın rolü ${ROLE_LABELS[role]} olarak güncellendi.`)
    } catch {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))
      toast.error("Rol güncellenemedi.")
    }
  }

  const handleToggleActive = async (u: User) => {
    const next = !u.is_active
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_active: next } : x)))
    try {
      await apiClient(`/admin/users/${u.id}/toggle-active`, { method: "PATCH" })
      toast.success(next ? `${u.name} etkinleştirildi.` : `${u.name} devre dışı bırakıldı.`)
    } catch {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))
      toast.error("Durum güncellenemedi.")
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) return
    setCreating(true)
    try {
      const created = await apiClient<User>("/admin/users", {
        method: "POST",
        body: JSON.stringify({ name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role }),
      })
      setUsers((prev) => [created, ...prev])
      setCreateOpen(false)
      setForm(EMPTY_FORM)
      toast.success(`${created.name} oluşturuldu.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Kullanıcı oluşturulamadı.")
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Kullanıcı Oluştur</DialogTitle>
            <DialogDescription>Sisteme yeni bir kullanıcı ekleyin. Kullanıcı oluşturulduktan sonra giriş yapabilir.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="new-name">Ad Soyad</Label>
              <Input id="new-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Ali Yılmaz" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-email">E-posta</Label>
              <Input id="new-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="ali@sirket.com" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">Şifre (min. 8 karakter)</Label>
              <Input id="new-password" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" required minLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-role">Sistem Rolü</Label>
              <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v as "admin" | "manager" | "member" }))}>
                <SelectTrigger id="new-role"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Yönetici</SelectItem>
                  <SelectItem value="manager">Yetkili</SelectItem>
                  <SelectItem value="member">Üye</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>İptal</Button>
              <Button type="submit" disabled={creating}>{creating ? "Oluşturuluyor…" : "Oluştur"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Sistem Kullanıcıları</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{users.length} hesap</p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => { setForm(EMPTY_FORM); setCreateOpen(true) }}>
            <PlusIcon className="size-3.5" />
            Yeni Kullanıcı
          </Button>
        </div>
        <div className="overflow-x-auto">
          {loadingUsers ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">Yükleniyor…</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground">
                  <th className="px-5 py-3 text-left font-medium">Kullanıcı</th>
                  <th className="px-4 py-3 text-left font-medium">Sistem Rolü</th>
                  <th className="px-4 py-3 text-left font-medium">Aktif</th>
                  <th className="px-4 py-3 text-left font-medium">Oluşturulma</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {initials(u.name)}
                          </div>
                          <div>
                            <p className="font-medium leading-tight">
                              {u.name}
                              {isSelf && (
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">(siz)</span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Select
                          value={u.role ?? "member"}
                          disabled={isSelf}
                          onValueChange={(newRole) =>
                            handleRoleChange(u, newRole as "admin" | "manager" | "member")
                          }
                        >
                          <SelectTrigger className="h-7 w-28 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin" className="text-xs">Yönetici</SelectItem>
                            <SelectItem value="manager" className="text-xs">Yetkili</SelectItem>
                            <SelectItem value="member" className="text-xs">Üye</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={u.is_active}
                          disabled={isSelf}
                          onCheckedChange={() => handleToggleActive(u)}
                        />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {new Date(u.created_at).toLocaleDateString("tr-TR", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const { tasks, activity } = useTasks()

  if (loading) return null
  if (!user?.is_admin) redirect("/dashboard")

  const tasksByStatus = {
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldIcon className="size-4" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Yönetici Paneli</h1>
              <p className="text-sm text-muted-foreground">Çalışma alanı genel görünümü ve yönetimi.</p>
            </div>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5">
              Yönetici
            </Badge>
          </div>

          {/* Stats grid */}
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

          {/* Google Drive */}
          <React.Suspense fallback={null}>
            <DriveSection />
          </React.Suspense>

          {/* Storage Configuration */}
          <StorageSection />

          {/* System users */}
          <UsersSection />

          {/* Recent activity */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">Son Etkinlik</h2>
              {activity.length > 7 && (
                <Link href="/admin/activity" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Tümünü görüntüle
                </Link>
              )}
            </div>
            <div className="divide-y divide-border/40">
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">Henüz etkinlik yok.</p>
              ) : (
                activity.slice(0, 7).map((entry) => {
                  const name = entry.userName ?? "Unknown User"
                  const ini = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {ini}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-medium">{name}</span>
                          {" "}{entry.taskTitle}{entry.detail ? ` — ${entry.detail}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}