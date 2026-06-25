"use client"

import React, { useState } from "react"
import Link from "next/link"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { MemberDialog } from "@/components/team/member-dialog"
import { DeleteMemberDialog } from "@/components/team/delete-member-dialog"
import { useAuth, useMockUsers, MOCK_AUTH } from "@/contexts/auth-context"
import { useTasks } from "@/contexts/task-context"
import { useTeam, TeamMember } from "@/contexts/team-context"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  ShieldIcon,
  UsersIcon,
  CheckSquareIcon,
  ActivityIcon,
  PlusIcon,
  PencilIcon,
  Trash2Icon,
  HardDriveIcon,
  InfoIcon,
} from "lucide-react"
import { redirect } from "next/navigation"
import { getStorageConfig, updateStoragePath } from "@/lib/actions/files"
import { Input } from "@/components/ui/input"

const STATUS_DOT: Record<TeamMember["status"], string> = {
  active: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-slate-400",
}

function StatusBadge({ status }: { status: TeamMember["status"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs capitalize text-muted-foreground">
      <span className={cn("size-1.5 rounded-full", STATUS_DOT[status])} />
      {status}
    </span>
  )
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
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
      toast.success("Storage path updated")
    } else {
      toast.error(res.error ?? "Failed to update storage path")
    }
    setSaving(false)
  }

  const sourceLabel = {
    env: { text: "Environment Variable", color: "text-violet-500 bg-violet-500/10" },
    config: { text: "Custom Config", color: "text-emerald-500 bg-emerald-500/10" },
    default: { text: "Default", color: "text-muted-foreground bg-muted/60" },
  }[source]

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HardDriveIcon className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Storage Configuration</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Where files are stored on disk. Change this to point to a shared network drive.
          </p>
        </div>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceLabel.color}`}>
          {sourceLabel.text}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Current Path</p>
          <p className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-sm break-all">{storagePath || "Loading…"}</p>
        </div>

        {source === "env" ? (
          <div className="flex items-start gap-2 rounded-lg bg-violet-500/5 border border-violet-500/20 px-3 py-2.5">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-violet-500" />
            <p className="text-xs text-muted-foreground">
              Path is controlled by the <code className="font-mono text-xs text-violet-500">FILE_STORAGE_PATH</code> environment variable and cannot be changed here.
              Remove the environment variable to enable UI configuration.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Set Custom Path</p>
            <div className="flex gap-2">
              <Input
                placeholder="/absolute/path/to/storage"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                className="font-mono text-sm"
              />
              <Button onClick={handleSave} disabled={saving || !pathInput.trim() || pathInput === storagePath} size="sm" className="shrink-0">
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                For multi-server setups, set the <code className="font-mono text-xs">FILE_STORAGE_PATH</code> environment variable instead — it takes precedence over this setting and applies immediately without saving to disk.
                The directory will be created if it doesn&apos;t exist.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function UsersSection() {
  const { user: currentUser } = useAuth()
  const { mockUsers, updateMockUser } = useMockUsers()

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Users</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {mockUsers.length} account{mockUsers.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/40 text-xs text-muted-foreground">
              <th className="px-5 py-3 text-left font-medium">User</th>
              <th className="px-4 py-3 text-left font-medium">Admin</th>
              <th className="px-4 py-3 text-left font-medium">Active</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {mockUsers.map((u) => {
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
                            <span className="ml-1.5 text-xs text-muted-foreground font-normal">(you)</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={u.is_admin}
                        disabled={isSelf}
                        onCheckedChange={(checked) => {
                          updateMockUser(u.id, { is_admin: checked })
                          toast.success(
                            checked
                              ? `Admin access granted to ${u.name}.`
                              : `Admin access revoked from ${u.name}.`
                          )
                        }}
                      />
                      {isSelf && (
                        <span className="text-xs text-muted-foreground">locked</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Switch
                      checked={u.is_active}
                      disabled={isSelf}
                      onCheckedChange={(checked) => {
                        updateMockUser(u.id, { is_active: checked })
                        toast.success(
                          checked
                            ? `${u.name} has been activated.`
                            : `${u.name} has been deactivated.`
                        )
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                    {new Date(u.created_at).toLocaleDateString("en-US", {
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
      </div>
    </div>
  )
}

export default function AdminPage() {
  const { user, loading } = useAuth()
  const { tasks, activity } = useTasks()
  const { members, addMember, updateMember, deleteMember } = useTeam()

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  if (loading) return null
  if (!user?.is_admin) redirect("/dashboard")

  const tasksByStatus = {
    "in-progress": tasks.filter((t) => t.status === "in-progress").length,
    done: tasks.filter((t) => t.status === "done").length,
  }

  const handleOpenAdd = () => {
    setEditingMember(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member)
    setIsDialogOpen(true)
  }

  const handleSave = (member: TeamMember) => {
    const isEdit = members.some((m) => m.id === member.id)
    if (isEdit) {
      updateMember(member.id, member)
      toast.success("Member updated", {
        description: `${member.name}'s profile has been updated.`,
      })
    } else {
      addMember(member)
      toast.success("Member added", {
        description: `${member.name} has been added to the team.`,
      })
    }
  }

  const handleConfirmDelete = () => {
    if (!deletingId) return
    const member = members.find((m) => m.id === deletingId)
    deleteMember(deletingId)
    setDeletingId(null)
    toast.success("Member removed", {
      description: member ? `${member.name} has been removed.` : "Member removed.",
    })
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
              <h1 className="text-2xl font-semibold tracking-tight">Admin Panel</h1>
              <p className="text-sm text-muted-foreground">Workspace overview and management.</p>
            </div>
            <Badge variant="outline" className="ml-auto border-primary/30 text-primary bg-primary/5">
              Admin
            </Badge>
          </div>

          {/* Stats grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: "Total Tasks", value: tasks.length, icon: CheckSquareIcon, color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40" },
              { label: "Team Members", value: members.length, icon: UsersIcon, color: "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40" },
              { label: "In Progress", value: tasksByStatus["in-progress"], icon: ActivityIcon, color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40" },
              { label: "Completed", value: tasksByStatus.done, icon: CheckSquareIcon, color: "text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-950/40" },
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

          {/* Storage Configuration */}
          <StorageSection />

          {/* Users section — only in mock auth mode */}
          {MOCK_AUTH && <UsersSection />}

          {/* Recent activity */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <h2 className="text-sm font-semibold">Recent Activity</h2>
              {activity.length > 7 && (
                <Link href="/admin/activity" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  View all
                </Link>
              )}
            </div>
            <div className="divide-y divide-border/40">
              {activity.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                activity.slice(0, 7).map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3 px-5 py-3">
                    <div className="mt-2 size-1.5 shrink-0 rounded-full bg-primary/60" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">
                        {entry.taskTitle}{entry.detail ? ` — ${entry.detail}` : ""}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Team Directory */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm">
            <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold">Team Directory</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">{members.length} member{members.length !== 1 ? "s" : ""}</p>
              </div>
              <Button size="sm" onClick={handleOpenAdd} className="gap-1.5">
                <PlusIcon className="size-3.5" />
                Add Member
              </Button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/40 text-xs text-muted-foreground">
                    <th className="px-5 py-3 text-left font-medium">Member</th>
                    <th className="px-4 py-3 text-left font-medium">Role</th>
                    <th className="px-4 py-3 text-left font-medium">Department</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Joined</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {members.map((m) => (
                    <tr key={m.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {initials(m.name)}
                          </div>
                          <div>
                            <p className="font-medium leading-tight">{m.name}</p>
                            <p className="text-xs text-muted-foreground">{m.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.role}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.department}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={m.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">
                        {new Date(m.joinedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(m)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Edit ${m.name}`}
                          >
                            <PencilIcon className="size-3.5" />
                          </button>
                          <button
                            onClick={() => setDeletingId(m.id)}
                            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remove ${m.name}`}
                          >
                            <Trash2Icon className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        <MemberDialog
          member={editingMember}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSave={handleSave}
        />

        <DeleteMemberDialog
          open={!!deletingId}
          memberName={members.find((m) => m.id === deletingId)?.name}
          onOpenChange={(open) => { if (!open) setDeletingId(null) }}
          onConfirm={handleConfirmDelete}
        />
      </SidebarInset>
    </SidebarProvider>
  )
}