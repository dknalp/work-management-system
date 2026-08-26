"use client"

/**
 * Admin — Role & Permission Management page.
 *
 * Displays a permission matrix table (rows = permissions, columns = roles).
 * Admins can toggle individual permission grants, add custom roles, delete
 * custom roles, and save all changes back to the backend.
 */

import React, { useEffect, useState } from "react"
import { ShieldIcon, PlusIcon, SaveIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { apiClient } from "@/lib/api"

/** Shape returned by GET /permissions/roles */
interface RoleEntry {
  name: string
  permissions: string[]
  is_system: boolean
}

const PERMISSIONS = [
  { key: "tasks:view",       label: "Görevleri Gör" },
  { key: "tasks:create",     label: "Görev Oluştur" },
  { key: "tasks:edit",       label: "Görev Düzenle" },
  { key: "tasks:delete",     label: "Görev Sil" },
  { key: "tasks:assign",     label: "Görev Ata" },
  { key: "board:view",       label: "Panoyu Gör" },
  { key: "board:edit",       label: "Panoyu Düzenle" },
  { key: "team:view",        label: "Ekibi Gör" },
  { key: "team:manage",      label: "Ekibi Yönet" },
  { key: "analytics:view",   label: "Analitiği Gör" },
  { key: "files:view",       label: "Dosyaları Gör" },
  { key: "files:upload",     label: "Dosya Yükle" },
  { key: "files:delete",     label: "Dosya Sil" },
  { key: "calendar:view",    label: "Takvimi Gör" },
  { key: "calendar:edit",    label: "Takvimi Düzenle" },
  { key: "admin:view",       label: "Yönetici Paneli" },
]

const SYSTEM_ROLE_LABELS: Record<string, string> = {
  admin:   "Yönetici",
  manager: "Yönetici",
  member:  "Üye",
}

function getRoleLabel(name: string): string {
  return SYSTEM_ROLE_LABELS[name] ?? name
}


export default function RolesPage() {
  const [roles, setRoles] = useState<RoleEntry[]>([])
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // New role dialog state
  const [newRoleOpen, setNewRoleOpen] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [copyFrom, setCopyFrom] = useState("none")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const data = await apiClient.get<RoleEntry[]>("/permissions/roles")
        setRoles(data)
        // Build matrix: matrix[roleName][permKey] = boolean
        const m: Record<string, Record<string, boolean>> = {}
        for (const role of data) {
          m[role.name] = {}
          for (const p of PERMISSIONS) {
            m[role.name][p.key] = role.permissions.includes(p.key)
          }
        }
        setMatrix(m)
      } catch {
        toast.error("İzinler yüklenemedi.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  function togglePermission(roleName: string, permKey: string) {
    setMatrix((prev) => ({
      ...prev,
      [roleName]: {
        ...prev[roleName],
        [permKey]: !prev[roleName]?.[permKey],
      },
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Build payload: array of { role, permission, granted }
      const updates: { role: string; permission: string; granted: boolean }[] = []
      for (const role of roles) {
        for (const p of PERMISSIONS) {
          updates.push({
            role: role.name,
            permission: p.key,
            granted: matrix[role.name]?.[p.key] ?? false,
          })
        }
      }
      await apiClient.post("/permissions/bulk-update", { updates })
      toast.success("İzinler kaydedildi.")
    } catch {
      toast.error("Kaydetme başarısız.")
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateRole() {
    const name = newRoleName.trim().toLowerCase().replace(/\s+/g, "_")
    if (!name) return
    setCreating(true)
    try {
      await apiClient.post("/permissions/roles", { name, copy_from: copyFrom === "none" ? null : copyFrom })
      // Reload roles
      const data = await apiClient.get<RoleEntry[]>("/permissions/roles")
      setRoles(data)
      const m: Record<string, Record<string, boolean>> = {}
      for (const role of data) {
        m[role.name] = {}
        for (const p of PERMISSIONS) {
          m[role.name][p.key] = role.permissions.includes(p.key)
        }
      }
      setMatrix(m)
      toast.success(`"${name}" rolü oluşturuldu.`)
      setNewRoleOpen(false)
    } catch {
      toast.error("Rol oluşturulamadı.")
    } finally {
      setCreating(false)
    }
  }

  async function handleDeleteRole(roleName: string) {
    if (!confirm(`"${roleName}" rolünü silmek istediğinizden emin misiniz?`)) return
    try {
      await apiClient.delete(`/permissions/roles/${roleName}`)
      setRoles((prev) => prev.filter((r) => r.name !== roleName))
      setMatrix((prev) => {
        const next = { ...prev }
        delete next[roleName]
        return next
      })
      toast.success(`"${roleName}" rolü silindi.`)
    } catch {
      toast.error("Rol silinemedi.")
    }
  }

  if (loading) {
    return (
      <AppShellDynamic>
          <main className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Yükleniyor…</p>
          </main>
      </AppShellDynamic>
    )
  }

  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10 space-y-6">

            {/* Page header */}
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
                  <ShieldIcon className="size-6" />
                  Rol & İzin Yönetimi
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

            {/* Permission matrix table */}
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
                              <Trash2Icon className="size-3" />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSIONS.map((perm, idx) => (
                    <tr
                      key={perm.key}
                      className={idx % 2 === 0 ? "bg-background" : "bg-muted/10"}
                    >
                      <td className="py-3 pl-4 pr-6 font-medium">
                        <div>
                          <span>{perm.label}</span>
                          <span className="ml-2 text-[10px] font-mono text-muted-foreground">
                            {perm.key}
                          </span>
                        </div>
                      </td>
                      {roles.map((role) => (
                        <td key={role.name} className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={matrix[role.name]?.[perm.key] ?? false}
                              onCheckedChange={() => togglePermission(role.name, perm.key)}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      {/* New Role Dialog */}
      <Dialog open={newRoleOpen} onOpenChange={setNewRoleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Yeni Rol Oluştur</DialogTitle>
            <DialogDescription>
              Özel bir rol oluşturun ve isteğe bağlı olarak mevcut bir rolün izinlerini kopyalayın.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Rol Adı</Label>
              <Input
                value={newRoleName}
                onChange={(e) => setNewRoleName(e.target.value)}
                placeholder="örn. viewer"
              />
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
    </AppShellDynamic>
  )
}