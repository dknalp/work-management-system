"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ShieldIcon, UserPlusIcon, LoaderIcon, CheckCircleIcon, XCircleIcon } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { apiClient } from "@/lib/api"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

type AdminUser = {
  id: string
  name: string
  email: string
  is_active: boolean
  is_admin: boolean
  created_at: string
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersLoading, setUsersLoading] = useState(true)

  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isAdmin, setIsAdmin] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)

  useEffect(() => {
    if (!loading && (!user || !user.is_admin)) {
      router.replace("/dashboard")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (!user?.is_admin) return
    apiClient<AdminUser[]>("/admin/users")
      .then(setUsers)
      .catch(() => toast.error("Failed to load users"))
      .finally(() => setUsersLoading(false))
  }, [user])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    setFormLoading(true)
    try {
      const newUser = await apiClient<AdminUser>("/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, email, password, is_admin: isAdmin }),
      })
      setUsers((prev) => [newUser, ...prev])
      setName("")
      setEmail("")
      setPassword("")
      setIsAdmin(false)
      toast.success(`User "${newUser.name}" created`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create user")
    } finally {
      setFormLoading(false)
    }
  }

  async function handleToggleActive(userId: string) {
    try {
      const updated = await apiClient<AdminUser>(`/admin/users/${userId}/toggle-active`, {
        method: "PATCH",
      })
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
      toast.success(`User ${updated.is_active ? "activated" : "deactivated"}`)
    } catch {
      toast.error("Failed to update user")
    }
  }

  if (loading || !user?.is_admin) {
    return null
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "16rem",
          "--header-height": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-col gap-6 p-6 lg:p-8">
          {/* Page title */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <ShieldIcon className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Manage user accounts</p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
            {/* Create user form */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserPlusIcon className="size-4" />
                  Create User
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-name">Full name</Label>
                    <Input
                      id="admin-name"
                      required
                      placeholder="Alex Johnson"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      required
                      placeholder="user@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="admin-is-admin"
                      checked={isAdmin}
                      onCheckedChange={(v) => setIsAdmin(v === true)}
                    />
                    <Label htmlFor="admin-is-admin" className="cursor-pointer font-normal">
                      Grant admin access
                    </Label>
                  </div>

                  {formError && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                      {formError}
                    </p>
                  )}

                  <Button type="submit" className="w-full" disabled={formLoading}>
                    {formLoading && <LoaderIcon className="mr-2 size-4 animate-spin" />}
                    Create account
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* User list */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">
                  All Users
                  {!usersLoading && (
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({users.length})
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <LoaderIcon className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="py-12 text-center text-sm text-muted-foreground">No users found</p>
                ) : (
                  <div className="divide-y divide-border">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between px-6 py-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium">{u.name}</span>
                            {u.is_admin && (
                              <Badge variant="secondary" className="shrink-0 text-xs">
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 pl-4">
                          {u.is_active ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                              <CheckCircleIcon className="size-3.5" />
                              Active
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <XCircleIcon className="size-3.5" />
                              Inactive
                            </span>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleToggleActive(u.id)}
                            disabled={u.id === user.id}
                          >
                            {u.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}