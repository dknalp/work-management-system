"use client"

/**
 * Profile page — lets the authenticated user view and edit their own profile.
 *
 * Displays: avatar (clickable to upload a new image), display name, email,
 * role badge, and an editable form for name and bio. Profile changes are
 * persisted to the backend via PATCH /users/me. Avatar uploads go to
 * POST /users/me/avatar with multipart/form-data. The AuthContext is updated
 * immediately on success so the new avatar and name are reflected everywhere
 * in the app without a page refresh.
 */

import { useRef, useState } from "react"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/contexts/auth-context"
import { tokenStorage } from "@/lib/auth"

/** Accepted MIME types for avatar uploads (must match backend validation). */
const ACCEPTED_IMAGE_TYPES = "image/jpeg,image/png,image/webp,image/gif"

export default function ProfilePage() {
  const { user, updateUser } = useAuth()

  const [name, setName] = useState(user?.name ?? "")
  const [bio, setBio] = useState(user?.bio ?? "")
  const [saving, setSaving] = useState(false)
  /** True while the avatar image is being uploaded to the backend. */
  const [avatarUploading, setAvatarUploading] = useState(false)

  /** Hidden file input triggered by clicking the avatar overlay. */
  const avatarFileRef = useRef<HTMLInputElement>(null)

  const initials = (user?.name ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  /**
   * Handle avatar file selection.
   *
   * Uploads the selected image to POST /users/me/avatar via raw fetch (multipart
   * FormData). On success, calls updateUser() so the new avatar is shown
   * immediately across the app. The input value is reset so the same file can
   * be re-selected after an error.
   */
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset the input so the same file can be re-selected after an error.
    e.target.value = ""

    const formData = new FormData()
    formData.append("file", file)

    const apiBase = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3052").replace(/\/$/, "")
    const token = tokenStorage.getAccess()

    setAvatarUploading(true)
    try {
      const res = await fetch(`${apiBase}/users/me/avatar`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({ detail: "Upload failed." }))
        toast.error(payload.detail ?? "Avatar upload failed.")
        return
      }

      const data: { avatar_url: string } = await res.json()
      updateUser({ avatar_url: data.avatar_url })
      toast.success("Avatar updated.")
    } catch {
      toast.error("Could not upload avatar. Check your connection and try again.")
    } finally {
      setAvatarUploading(false)
    }
  }

  /** Persist display name and bio changes to the backend via the AuthContext. */
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
              {/*
               * Clickable avatar wrapper — the hidden file input is triggered
               * by clicking anywhere on the avatar or its overlay icon.
               */}
              <button
                type="button"
                className="group relative size-20 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={() => avatarFileRef.current?.click()}
                aria-label="Upload avatar"
                disabled={avatarUploading}
              >
                <Avatar className="size-20">
                  <AvatarImage src={user?.avatar_url ?? ""} />
                  <AvatarFallback className="text-xl font-semibold bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Upload overlay — always visible while uploading, shown on hover otherwise */}
                <span className={[
                  "absolute inset-0 flex items-center justify-center rounded-full bg-black/40 transition-opacity",
                  avatarUploading ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                ].join(" ")}>
                  {avatarUploading ? (
                    <Loader2 className="size-5 text-white animate-spin" />
                  ) : (
                    <Camera className="size-5 text-white" />
                  )}
                </span>
              </button>

              {/* Hidden file picker — accepts image/* matching backend validation */}
              <input
                ref={avatarFileRef}
                type="file"
                accept={ACCEPTED_IMAGE_TYPES}
                className="sr-only"
                onChange={handleAvatarChange}
                aria-hidden="true"
              />

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

            {/* Personal information form */}
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

            {/* Account details (read-only) */}
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