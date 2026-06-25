"use client"

import React, { useState, useMemo } from "react"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SearchIcon,
  LayoutGridIcon,
  TableIcon,
  UsersIcon,
  UserCheckIcon,
  BuildingIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { useTeam, TeamMember } from "@/contexts/team-context"

// Re-export for backward compat
export type { TeamMember }

type ViewMode = "grid" | "table"

const DEPARTMENTS = [
  "All",
  "Engineering",
  "Infrastructure",
  "Product",
  "Design",
  "Analytics",
  "Marketing",
  "Human Resources",
  "Operations",
]

export default function TeamPage() {
  const { members, addMember, updateMember, deleteMember } = useTeam()
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("All")
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null)

  const stats = useMemo(() => {
    const total = members.length
    const active = members.filter((m) => m.status === "active").length
    const departments = new Set(members.map((m) => m.department)).size
    return { total, active, departments }
  }, [members])

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.role.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesDept =
        departmentFilter === "All" || m.department === departmentFilter
      return matchesSearch && matchesDept
    })
  }, [members, searchQuery, departmentFilter])

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member)
    setIsDialogOpen(true)
  }

  const handleSaveMember = (member: TeamMember) => {
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

  const handleRequestDelete = (id: string) => {
    setDeletingMemberId(id)
  }

  const handleConfirmDelete = () => {
    if (!deletingMemberId) return
    const member = members.find((m) => m.id === deletingMemberId)
    deleteMember(deletingMemberId)
    setDeletingMemberId(null)
    toast.success("Member removed", {
      description: member
        ? `${member.name} has been removed from the team.`
        : "Member removed.",
    })
  }

  const statCards = [
    {
      key: "total",
      label: "Total Members",
      value: stats.total,
      icon: UsersIcon,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      key: "active",
      label: "Active Now",
      value: stats.active,
      icon: UserCheckIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      key: "departments",
      label: "Departments",
      value: stats.departments,
      icon: BuildingIcon,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
  ]

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
              <h1 className="text-2xl font-bold tracking-tight">Team</h1>
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
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-9 rounded-lg border-border/40 bg-background/40 pl-9 text-sm focus-visible:ring-primary/20"
                  />
                </div>

                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger className="h-9 w-[160px] rounded-lg border-border/40 bg-background/40 text-sm">
                    <SelectValue placeholder="Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

                {(searchQuery || departmentFilter !== "All") && (
                  <Badge variant="secondary" className="h-7 px-2.5 text-xs font-medium">
                    {filteredMembers.length} result{filteredMembers.length !== 1 ? "s" : ""}
                  </Badge>
                )}
              </div>
            </div>

            {/* Content */}
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/20 bg-muted/5 py-24">
                <UsersIcon className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">No members found</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Try adjusting your search or filter.
                </p>
              </div>
            ) : viewMode === "table" ? (
              <TeamTable
                members={filteredMembers}
                onEdit={handleOpenEdit}
                onDelete={handleRequestDelete}
              />
            ) : (
              <MemberGrid
                members={filteredMembers}
                onEdit={handleOpenEdit}
                onDelete={handleRequestDelete}
              />
            )}
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
      </SidebarInset>
    </SidebarProvider>
  )
}