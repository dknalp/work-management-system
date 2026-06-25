"use client"

import { useState } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

export default function ProfilePage() {
  const { user, updateUser } = useAuth()

  const [name, setName] = useState(user?.name ?? "")
  const [bio, setBio] = useState(user?.bio ?? "")
  const [saving, setSaving] = useState(false)

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    try {
      updateUser({ name: name.trim(), bio: bio.trim() || null })
      toast.success("Profile updated")
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
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage your personal information.
            </p>
          </div>

          <div className="max-w-2xl space-y-8">
            {/* Avatar section */}
            <div className="flex items-center gap-5">
              <Avatar className="size-20">
                <AvatarImage src={user?.avatar_url ?? ""} />
                <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
                {user?.is_admin && (
                  <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Admin
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Form */}
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-5">
              <h2 className="text-base font-semibold">Personal Information</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={user?.email ?? ""}
                    disabled
                    className="bg-muted/50 text-muted-foreground"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short description about yourself..."
                  rows={3}
                  className="resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSave} disabled={saving || !name.trim()}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </div>

            {/* Account info */}
            <div className="rounded-xl border border-border/60 bg-card p-6 shadow-sm space-y-3">
              <h2 className="text-base font-semibold">Account Details</h2>
              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Member since</p>
                  <p className="font-medium">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Account status</p>
                  <p className="font-medium">
                    {user?.is_active ? (
                      <span className="text-emerald-600 dark:text-emerald-400">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
