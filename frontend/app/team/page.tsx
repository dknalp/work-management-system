"use client"

import React, { useState, useMemo, useEffect } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TeamTable } from "@/components/team/team-table"
import { MemberGrid } from "@/components/team/member-grid"
import { MemberDialog } from "@/components/team/member-dialog"
import { DeleteMemberDialog } from "@/components/team/delete-member-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import {
  SearchIcon,
  LayoutGridIcon,
  TableIcon,
  UsersIcon,
  UserCheckIcon,
  UserPlusIcon,
  PlusIcon,
  BotIcon,
  Trash2Icon,
  Settings2Icon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTeam, TeamMember } from "@/contexts/team-context"
import { usePermission } from "@/hooks/use-permission"
import { AccessDenied } from "@/components/auth/access-denied"
import { apiClient } from "@/lib/api"
import { createDefaultAgent } from "@/types/agent"
import { useRouter } from "next/navigation"
import { MOCK_AUTH } from "@/contexts/auth-context"

// Re-export for backward compat
export type { TeamMember }

type ViewMode = "grid" | "table"

/** Minimal shape of an agent config as returned by GET /api/v1/agents. */
interface AgentSummary {
  id: string
  name: string
  status: string
  config: { description?: string }
}

export default function TeamPage() {
  const canView = usePermission("team:view")
  const canManage = usePermission("team:manage")
  const { members, addMember, updateMember, deleteMember } = useTeam()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)

  // ── AI Agents — backend-persisted via /api/v1/agents ────────────────────
  const [agents, setAgents] = useState<AgentSummary[]>([])
  const [agentsLoading, setAgentsLoading] = useState(true)
  const [isAgentDialogOpen, setIsAgentDialogOpen] = useState(false)
  const [newAgentName, setNewAgentName] = useState("")
  const [newAgentDescription, setNewAgentDescription] = useState("")
  const [isCreatingAgent, setIsCreatingAgent] = useState(false)

  // Delete agent confirmation
  const [deletingAgent, setDeletingAgent] = useState<AgentSummary | null>(null)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState("")
  const [isDeletingAgent, setIsDeletingAgent] = useState(false)

  // Load agents from backend on mount.
  // In mock auth mode there is no Firebase token, so backend calls would fail with 401.
  // We skip the fetch and show an empty list instead.
  useEffect(() => {
    if (MOCK_AUTH) {
      setAgentsLoading(false)
      return
    }
    let cancelled = false
    apiClient.get<AgentSummary[]>("/api/v1/agents")
      .then((data) => { if (!cancelled) setAgents(data ?? []) })
      .catch((err: unknown) => { console.warn("[TeamPage] agents load failed:", err) })
      .finally(() => { if (!cancelled) setAgentsLoading(false) })
    return () => { cancelled = true }
  }, [])

  /** Create agent: POST to backend first, then navigate to builder with the real Firestore ID. */
  async function handleCreateAgent() {
    const name = newAgentName.trim()
    if (!name) return
    if (MOCK_AUTH) {
      toast.error("Ajan oluşturmak için gerçek kimlik doğrulama gerekli.")
      return
    }
    setIsCreatingAgent(true)
    try {
      const created = await apiClient.post<AgentSummary>("/api/v1/agents", {
        name,
        status: "draft",
        // Store a full default AIAgent config so the builder has something to load.
        config: createDefaultAgent("", name, newAgentDescription.trim()),
      })
      setAgents((prev) => [created, ...prev])
      setNewAgentName("")
      setNewAgentDescription("")
      setIsAgentDialogOpen(false)
      // Navigate to the builder with the real Firestore document ID.
      router.push(`/agent-builder/${created.id}`)
    } catch {
      toast.error("Ajan oluşturulamadı. Lütfen tekrar deneyin.")
    } finally {
      setIsCreatingAgent(false)
    }
  }

  function handleRequestDeleteAgent(agent: AgentSummary) {
    setDeletingAgent(agent)
    setDeleteConfirmInput("")
  }

  async function handleConfirmDeleteAgent() {
    if (!deletingAgent || deleteConfirmInput !== deletingAgent.name) return
    if (MOCK_AUTH) {
      toast.error("Ajan silmek için gerçek kimlik doğrulama gerekli.")
      return
    }
    setIsDeletingAgent(true)
    try {
      await apiClient.delete(`/api/v1/agents/${deletingAgent.id}`)
      setAgents((prev) => prev.filter((a) => a.id !== deletingAgent.id))
      toast.success("Agent silindi", { description: `${deletingAgent.name} kaldırıldı.` })
      setDeletingAgent(null)
      setDeleteConfirmInput("")
    } catch {
      toast.error("Ajan silinemedi. Lütfen tekrar deneyin.")
    } finally {
      setIsDeletingAgent(false)
    }
  }

  function handleCancelDeleteAgent() {
    setDeletingAgent(null)
    setDeleteConfirmInput("")
  }

  const stats = useMemo(() => {
    const total = members.length
    const active = members.filter((m) => m.status === "active").length
    return { total, active }
  }, [members])

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      return (
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })
  }, [members, searchQuery])

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member)
    setIsDialogOpen(true)
  }

  const handleSaveMember = (member: TeamMember) => {
    const isEdit = members.some((m) => m.id === member.id)
    if (isEdit) {
      updateMember(member.id, member)
      toast.success("Üye güncellendi", {
        description: `${member.name} güncellendi.`,
      })
    } else {
      addMember(member)
      toast.success("Üye eklendi", {
        description: `${member.name} ekibe eklendi.`,
      })
    }
  }

  const handleRequestDelete = (id: string) => {
    setDeletingMemberId(id)
  }

  const handleConfirmDelete = () => {
    if (!deletingMemberId) return
    const member = members.find((m) => m.id === deletingMemberId)
    deleteMember(deletingMemberId)
    setDeletingMemberId(null)
    toast.success("Üye kaldırıldı", {
      description: member
        ? `${member.name} ekipten çıkarıldı.`
        : "Üye kaldırıldı.",
    })
  }

  const statCards = [
    {
      key: "total",
      label: "Toplam Üye",
      value: stats.total,
      icon: UsersIcon,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      key: "active",
      label: "Şu An Aktif",
      value: stats.active,
      icon: UserCheckIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
  ]

  if (!canView) return (
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 64)", "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset><SiteHeader /><main className="flex flex-1 items-center justify-center"><AccessDenied /></main></SidebarInset>
    </SidebarProvider>
  )

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col overflow-auto bg-background/50">
          <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Ekip</h1>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {statCards.map((card) => {
                const Icon = card.icon
                return (
                  <div
                    key={card.key}
                    className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm"
                  >
                    <div
                      className={cn(
                        "flex size-11 flex-shrink-0 items-center justify-center rounded-xl",
                        card.bg
                      )}
                    >
                      <Icon className={cn("size-5", card.color)} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold tabular-nums">
                        {card.value}
                      </p>
                      <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                        {card.label}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="group relative w-full sm:w-64">
                  <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    placeholder="Üye ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 rounded-lg border-border/40 bg-background/40 pl-9 text-sm focus-visible:ring-primary/20"
                  />
                </div>

                {canManage && (
                  <Button
                    size="sm"
                    className="h-9 gap-1.5 shrink-0"
                    onClick={() => { setEditingMember(null); setIsDialogOpen(true) }}
                  >
                    <UserPlusIcon className="size-4" />
                    Üye Ekle
                  </Button>
                )}
                </div>

              <div className="flex w-full items-center gap-2 sm:w-auto">
                <div className="flex items-center gap-0.5 rounded-lg border border-border/40 bg-background/40 p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("table")}
                    className={cn(
                      "h-7 w-8 rounded-md p-0 transition-all",
                      viewMode === "table"
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-transparent hover:text-foreground"
                    )}
                  >
                    <TableIcon className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "h-7 w-8 rounded-md p-0 transition-all",
                      viewMode === "grid"
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
                        : "text-muted-foreground hover:bg-transparent hover:text-foreground"
                    )}
                  >
                    <LayoutGridIcon className="size-3.5" />
                  </Button>
                </div>

                {searchQuery && (
                  <Badge variant="secondary" className="h-7 px-2.5 text-xs font-medium">
                    {filteredMembers.length} sonuç
                  </Badge>
                )}
              </div>
            </div>

            {/* Content */}
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/20 bg-muted/5 py-24">
                <UsersIcon className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Üye bulunamadı</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Arama veya filtrenizi ayarlamayı deneyin.
                </p>
              </div>
            ) : viewMode === "table" ? (
              <TeamTable
                members={filteredMembers}
                onEdit={canManage ? handleOpenEdit : undefined}
                onDelete={canManage ? handleRequestDelete : undefined}
              />
            ) : (
              <MemberGrid
                members={filteredMembers}
                onEdit={canManage ? handleOpenEdit : undefined}
                onDelete={canManage ? handleRequestDelete : undefined}
              />
            )}
          {/* AI Agents */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border/40" />
              <span className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">AI Agents</span>
              <div className="h-px flex-1 bg-border/40" />
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {agentsLoading ? (
                <p className="col-span-full text-sm text-muted-foreground text-center py-4">Yükleniyor…</p>
              ) : agents.length === 0 ? (
                <p className="col-span-full text-sm text-muted-foreground text-center py-4">Henüz ajan yok.</p>
              ) : null}
              {!agentsLoading && agents.map((agent) => (
                <div
                  key={agent.id}
                  className="group relative flex flex-col items-center gap-3 rounded-2xl border border-border/50 bg-card/60 p-6 text-center backdrop-blur-sm transition-shadow hover:shadow-md"
                >
                  {/* Action buttons — visible on hover */}
                  <div className="absolute top-2.5 right-2.5 hidden items-center gap-1 group-hover:flex">
                    <Link
                      href={`/agent-builder/${agent.id}`}
                      className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
                    >
                      <Settings2Icon className="size-3.5" />
                    </Link>
                    <button
                      onClick={() => handleRequestDeleteAgent(agent)}
                      className="flex size-6 items-center justify-center rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20"
                    >
                      <Trash2Icon className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex size-16 items-center justify-center rounded-full bg-muted">
                    <BotIcon className="size-7 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{agent.name}</p>
                    {agent.config?.description && (
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{agent.config.description}</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Create new agent card */}
              <button
                onClick={() => setIsAgentDialogOpen(true)}
                className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/50 bg-card/30 p-6 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <PlusIcon className="size-8" strokeWidth={1.5} />
                <span className="text-sm">create new agent</span>
              </button>
            </div>
          </div>
          </div>
        </main>

        <MemberDialog
          member={editingMember}
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          onSave={handleSaveMember}
        />

        <DeleteMemberDialog
          open={!!deletingMemberId}
          memberName={members.find((m) => m.id === deletingMemberId)?.name}
          onOpenChange={(open) => {
            if (!open) setDeletingMemberId(null)
          }}
          onConfirm={handleConfirmDelete}
        />

        {/* Delete Agent Confirmation Dialog */}
        <Dialog open={!!deletingAgent} onOpenChange={(open) => { if (!open) handleCancelDeleteAgent() }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2Icon className="size-5" />
                Delete AI Agent
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. To confirm, type the agent name{" "}
                <span className="font-semibold text-foreground">{deletingAgent?.name}</span> below.
              </p>
              <Input
                placeholder={deletingAgent?.name ?? ""}
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirmDeleteAgent() }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCancelDeleteAgent}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={handleConfirmDeleteAgent}
                disabled={deleteConfirmInput !== deletingAgent?.name || isDeletingAgent}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create Agent Dialog */}
        <Dialog open={isAgentDialogOpen} onOpenChange={setIsAgentDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BotIcon className="size-5 text-primary" />
                New AI Agent
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="agent-name">Name</Label>
                <Input
                  id="agent-name"
                  placeholder="e.g. Support Bot"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleCreateAgent() }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="agent-desc">Description</Label>
                <Textarea
                  id="agent-desc"
                  placeholder="What does this agent do?"
                  rows={3}
                  value={newAgentDescription}
                  onChange={(e) => setNewAgentDescription(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAgentDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateAgent} disabled={!newAgentName.trim() || isCreatingAgent}>
                <PlusIcon className="size-4" />
                {isCreatingAgent ? "Oluşturuluyor…" : "Oluştur"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}