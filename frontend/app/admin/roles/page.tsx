"use client"

import React, { useEffect, useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuth, MOCK_AUTH } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import { AccessDenied } from "@/components/auth/access-denied"
import { apiClient } from "@/lib/api"
import {
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  PERMISSION_GROUPS,
  type Permission,
} from "@/lib/permissions"
import { ShieldIcon, SaveIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type RoleResponse = {
  name: string
  is_system: boolean
  created_at: string
}

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin: "Yönetici",
  manager: "Yetkili",
  member: "Üye",
}

function getRoleLabel(name: string): string {
  return SYSTEM_ROLE_LABELS[name] ?? name
}

const MOCK_CUSTOM_ROLES_KEY = "wms:custom_roles"

function getSystemRoles(): RoleResponse[] {
  return [
    { name: "admin", is_system: true, created_at: "" },
    { name: "manager", is_system: true, created_at: "" },
    { name: "member", is_system: true, created_at: "" },
  ]
}

function getAllMockRoles(): RoleResponse[] {
  if (typeof window === "undefined") return getSystemRoles()
  try {
    const raw = localStorage.getItem(MOCK_CUSTOM_ROLES_KEY)
    const custom: RoleResponse[] = raw ? JSON.parse(raw) : []
    return [...getSystemRoles(), ...custom]
  } catch {
    return getSystemRoles()
  }
}

function saveMockCustomRoles(custom: RoleResponse[]) {
  localStorage.setItem(MOCK_CUSTOM_ROLES_KEY, JSON.stringify(custom))
}

function isValidSlug(s: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/.test(s)
}

function useAdminData() {
  const [roles, setRoles] = useState<RoleResponse[]>([])
  const [permsMap, setPermsMap] = useState<Record<string, Permission[]>>({})
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (MOCK_AUTH) {
      const allRoles = getAllMockRoles()
      setRoles(allRoles)
      const stored = localStorage.getItem("wms:role_permissions")
      const map: Record<string, Permission[]> = {}
      const def = DEFAULT_ROLE_PERMISSIONS as Record<string, Permission[]>
      for (const role of allRoles) {
        if (stored) {
          try {
            const parsed = JSON.parse(stored)
            map[role.name] = parsed[role.name] ?? def[role.name] ?? []
          } catch {
            map[role.name] = def[role.name] ?? []
          }
        } else {
          map[role.name] = def[role.name] ?? []
        }
      }
      setPermsMap(map)
      setLoading(false)
      return
    }
    try {
      const [rolesData, permsData] = await Promise.all([
        apiClient<RoleResponse[]>("/permissions/admin/roles"),
        apiClient<{ role: string; permissions: string[] }[]>("/permissions/admin/permissions"),
      ])
      setRoles(rolesData)
      const map: Record<string, Permission[]> = {}
      for (const row of permsData) {
        map[row.role] = row.permissions as Permission[]
      }
      setPermsMap(map)
    } catch {
      toast.error("Veriler yüklenemedi")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  return { roles, setRoles, permsMap, setPermsMap, loading, reload: load }
}

export default function RolesPage() {
  const canManagePerms = usePermission("admin:manage_permissions")
  const { user } = useAuth()
  const { roles, setRoles, permsMap, setPermsMap, loading, reload } = useAdminData()
  const [saving, setSaving] = useState(false)
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [copyFrom, setCopyFrom] = useState<string>("none")
  const [creating, setCreating] = useState(false)

  if (!canManagePerms) return <AccessDenied />

  function togglePermission(role: string, perm: Permission) {
    setPermsMap((prev) => {
      const current = prev[role] ?? []
      const updated = current.includes(perm)
        ? current.filter((p) => p !== perm)
        : [...current, perm]
      return { ...prev, [role]: updated }
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      if (MOCK_AUTH) {
        localStorage.setItem("wms:role_permissions", JSON.stringify(permsMap))
        toast.success("İzinler kaydedildi")
      } else {
        await apiClient("/permissions/admin/permissions", {
          method: "PUT",
          body: JSON.stringify(
            Object.entries(permsMap).map(([role, perms]) => ({ role, permissions: perms }))
          ),
        })
        toast.success("İzinler kaydedildi")
      }
    } catch {
      toast.error("Kaydetme başarısız")
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateRole() {
    const name = newRoleName.trim().toLowerCase()
    if (!name || !isValidSlug(name)) {
      toast.error("Geçersiz rol adı. Küçük harf, rakam, tire veya alt çizgi kullanın.")
      return
    }
    if (roles.some((r) => r.name === name)) {
      toast.error("Bu isimde bir rol zaten mevcut.")
      return
    }
    setCreating(true)
    try {
      const newRole: RoleResponse = { name, is_system: false, created_at: new Date().toISOString() }
      if (MOCK_AUTH) {
        const existing = roles.filter((r) => !r.is_system)
        saveMockCustomRoles([...existing, newRole])
        const sourcePerms = copyFrom !== "none" ? [...(permsMap[copyFrom] ?? [])] : []
        setPermsMap((prev) => ({ ...prev, [name]: sourcePerms }))
        setRoles((prev) => [...prev, newRole])
      } else {
        await apiClient("/permissions/admin/roles", {
          method: "POST",
          body: JSON.stringify({ name, copy_from: copyFrom !== "none" ? copyFrom : null }),
        })
        await reload()
      }
      toast.success(`"${name}" rolü oluşturuldu`)
      setNewRoleOpen(false)
      setNewRoleName("")
      setCopyFrom("none")
    } catch {
      toast.error("Rol oluşturulamadı")
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteRole(name: string) {
    if (!confirm(`"${name}" rolünü silmek istediğinize emin misiniz?`)) return
    try {
      if (MOCK_AUTH) {
        const remaining = roles.filter((r) => !r.is_system && r.name !== name)
        saveMockCustomRoles(remaining)
        setRoles((prev) => prev.filter((r) => r.name !== name))
        setPermsMap((prev) => {
          const next = { ...prev }
          delete next[name]
          return next
        })
      } else {
        await apiClient(`/permissions/admin/roles/${name}`, { method: "DELETE" })
        await reload()
      }
      toast.success(`"${name}" rolü silindi`)
    } catch {
      toast.error("Rol silinemedi")
    }
  }

  const sidebarStyle = {
    "--sidebar-width": "calc(var(--spacing) * 64)",
    "--header-height": "calc(var(--spacing) * 14)",
  } as React.CSSProperties

  if (loading) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <AppSidebar variant="inset" />
        <SidebarInset>
          <SiteHeader />
          <main className="flex flex-1 items-center justify-center bg-background">
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          </main>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  <ShieldIcon className="size-6" />
                  Rol &amp; İzin Yönetimi
                </h1>
                <p className="text-sm text-muted-foreground">
                  Rollere atanmış izinleri düzenleyin veya yeni özel roller oluşturun.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    setNewRoleName("")
                    setCopyFrom("none")
                    setNewRoleOpen(true)
                  }}
                >
                  <PlusIcon className="size-4" />
                  Yeni Rol
                </Button>
                <Button size="sm" className="gap-2" onClick={handleSave} disabled={saving}>
                  <SaveIcon className="size-4" />
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </Button>
              </div>
            </div>

            {/* Permission Matrix */}
            <div className="overflow-x-auto rounded-xl border border-border/50">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="py-3 pl-4 pr-6 text-left font-medium text-muted-foreground w-64">
                      İzin
                    </th>
                    {roles.map((role) => (
                      <th key={role.name} className="px-4 py-3 text-center font-medium min-w-[100px]">
                        <div className="flex flex-col items-center gap-1">
                          <span>{getRoleLabel(role.name)}</span>
                          <span className="text-[10px] text-muted-foreground font-normal">{role.name}</span>
                          {!role.is_system && (
                            <button
                              onClick={() => handleDeleteRole(role.name)}
                              className="mt-0.5 text-destructive hover:text-destructive/80 transition-colors"
                              title={`"${role.name}" rolünü sil`}
                            >
                              <Trash2Icon className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map((group) => (
                    <React.Fragment key={group.label}>
                      <tr className="border-b border-border/30 bg-muted/10">
                        <td
                          colSpan={roles.length + 1}
                          className="py-2 pl-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                        >
                          {group.label}
                        </td>
                      </tr>
                      {group.permissions.map((perm) => (
                        <tr
                          key={perm}
                          className="border-b border-border/20 hover:bg-muted/20 transition-colors"
                        >
                          <td className="py-3 pl-4 pr-6">
                            <div className="flex flex-col">
                              <span className="font-medium">{PERMISSION_LABELS[perm]}</span>
                              <span className="text-xs text-muted-foreground font-mono">{perm}</span>
                            </div>
                          </td>
                          {roles.map((role) => {
                            const hasIt = (permsMap[role.name] ?? []).includes(perm)
                            const isAdminRole = role.name === "admin"
                            return (
                              <td key={role.name} className="px-4 py-3 text-center">
                                <div className="flex items-center justify-center">
                                  <Checkbox
                                    checked={hasIt}
                                    disabled={isAdminRole}
                                    onCheckedChange={() =>
                                      !isAdminRole && togglePermission(role.name, perm)
                                    }
                                    className={cn(isAdminRole && "opacity-60 cursor-not-allowed")}
                                  />
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </SidebarInset>

      {/* New Role Dialog */}
      <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Yeni Rol Oluştur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Rol Adı</Label>
              <Input
                id="role-name"
                placeholder="örn: developer, reviewer, viewer"
                value={newRoleName}
                onChange={(e) =>
                  setNewRoleName(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))
                }
              />
              <p className="text-xs text-muted-foreground">
                Küçük harf, rakam, tire (-) veya alt çizgi (_) kullanabilirsiniz.
              </p>
            </div>
            <div className="space-y-2">
              <Label>İzinleri Kopyala (isteğe bağlı)</Label>
              <Select value={copyFrom} onValueChange={setCopyFrom}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Boş başla</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.name} value={r.name}>
                      {getRoleLabel(r.name)} ({r.name})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewRoleOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleCreateRole}
              disabled={creating || !newRoleName.trim()}
            >
              {creating ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}