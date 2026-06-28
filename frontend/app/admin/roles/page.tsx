"use client"

import React, { useEffect, useState } from "react"
import { redirect } from "next/navigation"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { useAuth } from "@/contexts/auth-context"
import { usePermissions } from "@/contexts/permissions-context"
import { apiClient } from "@/lib/api"
import { MOCK_AUTH } from "@/contexts/auth-context"
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSION_LABELS,
  type Permission,
  type Role,
} from "@/lib/permissions"
import { ShieldIcon, SaveIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

type RolePermissionsMap = { role: string; permissions: string[] }

const ROLE_LABELS: Record<Role, string> = {
  admin: "Yönetici",
  manager: "Yetkili",
  member: "Üye",
}

const ROLES: Role[] = ["admin", "manager", "member"]

function useRolePermissions() {
  const [data, setData] = useState<Record<Role, Permission[]>>({
    admin: [],
    manager: [],
    member: [],
  })
  const [loading, setLoading] = useState(true)

  const load = async () => {
    if (MOCK_AUTH) {
      const stored = localStorage.getItem("wms:role_permissions")
      if (stored) {
        try {
          setData(JSON.parse(stored))
        } catch {
          setData(DEFAULT_ROLE_PERMISSIONS)
        }
      } else {
        setData(DEFAULT_ROLE_PERMISSIONS)
      }
      setLoading(false)
      return
    }
    try {
      const rows = await apiClient<RolePermissionsMap[]>("/admin/permissions")
      const map: Record<Role, Permission[]> = { admin: [], manager: [], member: [] }
      for (const row of rows) {
        if (row.role in map) {
          map[row.role as Role] = row.permissions as Permission[]
        }
      }
      setData(map)
    } catch {
      setData(DEFAULT_ROLE_PERMISSIONS)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])
  return { data, setData, loading, reload: load }
}

export default function RolesPage() {
  const { user, loading: authLoading } = useAuth()
  const { refresh: refreshPermissions } = usePermissions()
  const { data, setData, loading } = useRolePermissions()
  const [saving, setSaving] = useState(false)

  if (authLoading) return null
  if (!user || user.role !== "admin") redirect("/dashboard")

  const toggle = (role: Role, perm: Permission) => {
    setData((prev) => {
      const current = prev[role]
      const next = current.includes(perm)
        ? current.filter((p) => p !== perm)
        : [...current, perm]
      return { ...prev, [role]: next }
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const body = ROLES.map((role) => ({ role, permissions: data[role] }))

      if (MOCK_AUTH) {
        localStorage.setItem("wms:role_permissions", JSON.stringify(data))
        refreshPermissions()
        toast.success("İzinler kaydedildi")
        setSaving(false)
        return
      }

      await apiClient("/admin/permissions", {
        method: "PUT",
        body: JSON.stringify(body),
      })
      refreshPermissions()
      toast.success("İzinler kaydedildi")
    } catch {
      toast.error("Kaydetme başarısız")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem", "--header-height": "3.5rem" } as React.CSSProperties}>
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col gap-6 p-6 lg:p-8">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldIcon className="size-4" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Rol İzinleri</h1>
              <p className="text-sm text-muted-foreground">Her rol için özellik izinlerini yönetin.</p>
            </div>
            <Button
              className="ml-auto gap-2"
              onClick={save}
              disabled={saving || loading}
            >
              <SaveIcon className="size-4" />
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              Yükleniyor…
            </div>
          ) : (
            <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="px-5 py-3.5 text-left font-medium text-muted-foreground">İzin</th>
                    {ROLES.map((role) => (
                      <th key={role} className="px-4 py-3.5 text-center font-medium">
                        {ROLE_LABELS[role]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {ALL_PERMISSIONS.map((perm) => (
                    <tr key={perm} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div>
                          <p className="font-medium text-foreground">{PERMISSION_LABELS[perm]}</p>
                          <p className="text-xs text-muted-foreground font-mono">{perm}</p>
                        </div>
                      </td>
                      {ROLES.map((role) => (
                        <td key={role} className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                            <Checkbox
                              checked={data[role].includes(perm)}
                              disabled={role === "admin"}
                              onCheckedChange={() => toggle(role, perm)}
                              className={cn(role === "admin" && "opacity-60 cursor-not-allowed")}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-t border-border/40 px-5 py-3 text-xs text-muted-foreground">
                Yönetici rolü her zaman tüm izinlere sahiptir ve değiştirilemez.
              </div>
            </div>
          )}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}