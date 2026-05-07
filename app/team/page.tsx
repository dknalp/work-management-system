"use client"

import React, { useState, useMemo } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
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
  PlusIcon,
  SearchIcon,
  LayoutGridIcon,
  TableIcon,
  UsersIcon,
  UserCheckIcon,
  BuildingIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  department: string
  status: "active" | "away" | "offline"
  avatar?: string
  joinedAt: string
  phone?: string
}

const initialMembers: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Chen",
    email: "sarah.chen@worksync.io",
    role: "Product Owner",
    department: "Product",
    status: "active",
    joinedAt: "2023-03-12",
    phone: "+1 (555) 123-4567",
  },
  {
    id: "2",
    name: "Michael Ross",
    email: "michael.ross@worksync.io",
    role: "Senior Developer",
    department: "Engineering",
    status: "active",
    joinedAt: "2022-06-27",
    phone: "+1 (555) 987-6543",
  },
  {
    id: "3",
    name: "Emily Watson",
    email: "emily.watson@worksync.io",
    role: "UI/UX Designer",
    department: "Design",
    status: "away",
    joinedAt: "2024-01-08",
    phone: "+1 (555) 456-7890",
  },
  {
    id: "4",
    name: "James Nakamura",
    email: "james.nakamura@worksync.io",
    role: "DevOps Engineer",
    department: "Engineering",
    status: "active",
    joinedAt: "2022-11-15",
    phone: "+1 (555) 234-5678",
  },
  {
    id: "5",
    name: "Priya Sharma",
    email: "priya.sharma@worksync.io",
    role: "Data Analyst",
    department: "Analytics",
    status: "active",
    joinedAt: "2023-07-20",
    phone: "+1 (555) 345-6789",
  },
  {
    id: "6",
    name: "Lucas Becker",
    email: "lucas.becker@worksync.io",
    role: "QA Engineer",
    department: "Engineering",
    status: "offline",
    joinedAt: "2023-09-05",
    phone: "+1 (555) 456-8901",
  },
  {
    id: "7",
    name: "Olivia Martínez",
    email: "olivia.martinez@worksync.io",
    role: "Scrum Master",
    department: "Product",
    status: "active",
    joinedAt: "2021-12-01",
    phone: "+1 (555) 567-9012",
  },
  {
    id: "8",
    name: "Ethan Park",
    email: "ethan.park@worksync.io",
    role: "Frontend Developer",
    department: "Engineering",
    status: "away",
    joinedAt: "2024-02-19",
    phone: "+1 (555) 678-0123",
  },
  {
    id: "9",
    name: "Nina Johansson",
    email: "nina.johansson@worksync.io",
    role: "Marketing Manager",
    department: "Marketing",
    status: "active",
    joinedAt: "2022-04-11",
    phone: "+1 (555) 789-1234",
  },
  {
    id: "10",
    name: "David Okafor",
    email: "david.okafor@worksync.io",
    role: "Backend Developer",
    department: "Engineering",
    status: "active",
    joinedAt: "2023-05-30",
    phone: "+1 (555) 890-2345",
  },
  {
    id: "11",
    name: "Aisha Patel",
    email: "aisha.patel@worksync.io",
    role: "HR Specialist",
    department: "Human Resources",
    status: "offline",
    joinedAt: "2023-10-14",
    phone: "+1 (555) 901-3456",
  },
  {
    id: "12",
    name: "Tom Reeves",
    email: "tom.reeves@worksync.io",
    role: "Engineering Manager",
    department: "Engineering",
    status: "active",
    joinedAt: "2021-08-23",
    phone: "+1 (555) 012-4567",
  },
]

type ViewMode = "grid" | "table"

const DEPARTMENTS = [
  "All",
  "Engineering",
  "Product",
  "Design",
  "Analytics",
  "Marketing",
  "Human Resources",
]

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>(initialMembers)
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

  const handleOpenAdd = () => {
    setEditingMember(null)
    setIsDialogOpen(true)
  }

  const handleOpenEdit = (member: TeamMember) => {
    setEditingMember(member)
    setIsDialogOpen(true)
  }

  const handleSaveMember = (member: TeamMember) => {
    const isEdit = members.some((m) => m.id === member.id)
    if (isEdit) {
      setMembers((prev) => prev.map((m) => (m.id === member.id ? member : m)))
      toast.success("Member updated", {
        description: `${member.name}'s profile has been updated.`,
      })
    } else {
      setMembers((prev) => [...prev, member])
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
    setMembers((prev) => prev.filter((m) => m.id !== deletingMemberId))
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
      glow: "bg-violet-500",
    },
    {
      key: "active",
      label: "Active Now",
      value: stats.active,
      icon: UserCheckIcon,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      glow: "bg-emerald-500",
    },
    {
      key: "departments",
      label: "Departments",
      value: stats.departments,
      icon: BuildingIcon,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      glow: "bg-blue-500",
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
            {/* Page Title */}
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-bold tracking-tight">Team</h1>
              <p className="text-sm text-muted-foreground">
                Manage your team members, roles and departments.
              </p>
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
                    <div
                      className={cn(
                        "absolute -top-4 -right-4 size-20 rounded-full opacity-10 blur-2xl",
                        card.glow
                      )}
                    />
                  </div>
                )
              })}
            </div>

            {/* Toolbar */}
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              {/* Left: Search + Department filter */}
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

                <Select
                  value={departmentFilter}
                  onValueChange={setDepartmentFilter}
                >
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

              {/* Right: View Toggle + Add */}
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {/* View Mode Toggle */}
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

                {/* Results badge */}
                {(searchQuery || departmentFilter !== "All") && (
                  <Badge
                    variant="secondary"
                    className="h-7 px-2.5 text-xs font-medium"
                  >
                    {filteredMembers.length} result
                    {filteredMembers.length !== 1 ? "s" : ""}
                  </Badge>
                )}

                <Button
                  size="sm"
                  onClick={handleOpenAdd}
                  className="h-9 gap-2 rounded-lg bg-primary px-4 font-medium shadow-sm hover:bg-primary/90"
                >
                  <PlusIcon className="size-4" />
                  Add Member
                </Button>
              </div>
            </div>

            {/* Content */}
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-border/20 bg-muted/5 py-24">
                <UsersIcon className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  No members found
                </p>
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
