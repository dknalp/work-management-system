"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { UserPlusIcon, MoreVerticalIcon, Trash2Icon, ShieldIcon, KeyRoundIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth, MOCK_AUTH, type User } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import { apiClient } from "@/lib/api"
import { toast } from "sonner"
import { getAllRoles, initials, ROLE_LABELS } from "./admin-shared"

const EMPTY_FORM = { name: "", email: "", password: "", role: "member" }

export function UsersSection() {
  const { user: currentUser } = useAuth()
  const canManage = usePermission("team:manage")
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [creating, setCreating] = React.useState(false)
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const allRoles = React.useMemo(() => getAllRoles(), [])

  const loadUsers = React.useCallback(async () => {
    setLoading(true)
    try {
      if (MOCK_AUTH) {
        const stored = localStorage.getItem("wms:mock_users")
        setUsers(stored ? JSON.parse(stored) : [])
      } else {
        const data = await apiClient.get<User[]>("/admin/users")
        setUsers(data)
      }
    } catch {
      toast.error("Kullanıcılar yüklenemedi")
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { loadUsers() }, [loadUsers])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      if (MOCK_AUTH) {
        const newUser: User = {
          id: crypto.randomUUID(),
          name: form.name,
          email: form.email,
          role: form.role as User["role"],
          is_admin: form.role === "admin",
          avatar: null,
        }
        const updated = [...users, newUser]
        setUsers(updated)
        localStorage.setItem("wms:mock_users", JSON.stringify(updated))
        toast.success("Kullanıcı oluşturuldu")
      } else {
        await apiClient.post("/admin/users", form)
        toast.success("Kullanıcı oluşturuldu")
        await loadUsers()
      }
      setForm(EMPTY_FORM)
      setDialogOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Oluşturma başarısız")
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (userId: string) => {
    try {
      if (MOCK_AUTH) {
        const updated = users.filter((u) => u.id !== userId)
        setUsers(updated)
        localStorage.setItem("wms:mock_users", JSON.stringify(updated))
      } else {
        await apiClient.delete(`/admin/users/${userId}`)
        await loadUsers()
      }
      toast.success("Kullanıcı silindi")
    } catch {
      toast.error("Silme başarısız")
    }
  }

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      if (MOCK_AUTH) {
        const updated = users.map((u) => u.id === userId ? { ...u, role: role as User["role"], is_admin: role === "admin" } : u)
        setUsers(updated)
        localStorage.setItem("wms:mock_users", JSON.stringify(updated))
      } else {
        await apiClient.patch(`/admin/users/${userId}`, { role })
        await loadUsers()
      }
      const label = ROLE_LABELS[role] ?? role
      toast.success(`Rol güncellendi: ${label}`)
    } catch {
      toast.error("Rol güncellenemedi")
    }
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ShieldIcon className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Kullanıcı Yönetimi</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{users.length} kullanıcı</p>
        </div>
        {canManage && (
          <div className="ml-auto">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 text-xs">
                  <UserPlusIcon className="size-3.5" /> Kullanıcı Ekle
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Yeni Kullanıcı</DialogTitle></DialogHeader>
                <form onSubmit={handleCreate} className="space-y-3">
                  <div className="space-y-1">
                    <Label>Ad Soyad</Label>
                    <Input placeholder="John Doe" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>E-posta</Label>
                    <Input type="email" placeholder="john@example.com" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Şifre</Label>
                    <Input type="password" placeholder="••••••••" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} required />
                  </div>
                  <div className="space-y-1">
                    <Label>Rol</Label>
                    <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {allRoles.map((r) => (<SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={creating} className="w-full">
                      {creating ? "Oluşturuluyor…" : "Oluştur"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="divide-y divide-border/40">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Yükleniyor…</div>
        ) : users.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Henüz kullanıcı yok</div>
        ) : users.map((u) => (
          <div key={u.id} className="flex items-center gap-3 px-5 py-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
              {u.avatar ? <img src={u.avatar} alt={u.name ?? ""} className="size-8 rounded-full object-cover" /> : initials(u.name ?? u.email ?? "?")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{u.name ?? u.email}</p>
              <p className="truncate text-xs text-muted-foreground">{u.email}</p>
            </div>
            <Badge variant="outline" className="hidden shrink-0 text-xs sm:inline-flex">
              {ROLE_LABELS[u.role ?? "member"] ?? u.role}
            </Badge>
            {canManage && u.id !== currentUser?.id && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-7 shrink-0">
                    <MoreVerticalIcon className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {allRoles.map((r) => (
                    <DropdownMenuItem key={r.name} onClick={() => handleRoleChange(u.id, r.name)} className={u.role === r.name ? "font-semibold" : ""}>
                      <ShieldIcon className="mr-2 size-3.5" /> {r.label} Yap
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(u.id)}>
                    <Trash2Icon className="mr-2 size-3.5" /> Sil
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}