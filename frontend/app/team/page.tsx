"use client"

import React, { useState } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TeamTable } from "@/components/team/team-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { UserPlus } from "lucide-react"
import { useTeam, TeamMember } from "@/contexts/team-context"
import { toast } from "sonner"

// Re-export for backward compat with any imports from this module
export type { TeamMember }

const DEPARTMENTS = ["Engineering", "Infrastructure", "Product", "Design", "Analytics", "Marketing", "Operations"]
const ROLES = [
  "Frontend Engineer",
  "Backend Engineer",
  "Full-Stack Engineer",
  "DevOps Engineer",
  "QA Engineer",
  "Mobile Developer",
  "Security Engineer",
  "Data Analyst",
  "UX Designer",
  "Product Manager",
  "Scrum Master",
  "Tech Lead",
  "Engineering Manager",
]

export default function TeamPage() {
  const { members, addMember, updateMember, deleteMember } = useTeam()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "",
    department: "",
    phone: "",
  })

  function handleAdd() {
    if (!form.name.trim() || !form.email.trim()) return
    const newMember: TeamMember = {
      id: `tm-${Date.now()}`,
      name: form.name.trim(),
      email: form.email.trim(),
      role: form.role || "Team Member",
      department: form.department || "Engineering",
      status: "active",
      joinedAt: new Date().toISOString().slice(0, 10),
      phone: form.phone.trim() || undefined,
    }
    addMember(newMember)
    toast.success(`${newMember.name} added to the team`)
    setForm({ name: "", email: "", role: "", department: "", phone: "" })
    setOpen(false)
  }

  function field(key: keyof typeof form) {
    return {
      value: form[key],
      onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm((prev) => ({ ...prev, [key]: e.target.value })),
    }
  }

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
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {members.length} member{members.length !== 1 ? "s" : ""}
                </p>
              </div>
              <Button onClick={() => setOpen(true)}>
                <UserPlus size={16} className="mr-2" />
                Add member
              </Button>
            </div>

            <TeamTable
              members={members}
              onDeleteMember={(id) => {
                deleteMember(id)
                toast.success("Member removed")
              }}
              onUpdateMember={(id, updates) => updateMember(id, updates)}
            />
          </div>
        </main>
      </SidebarInset>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Input placeholder="Full name *" {...field("name")} />
            <Input placeholder="Email *" type="email" {...field("email")} />
            <Select
              value={form.role}
              onValueChange={(v) => setForm((p) => ({ ...p, role: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={form.department}
              onValueChange={(v) => setForm((p) => ({ ...p, department: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Phone (optional)" {...field("phone")} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!form.name.trim() || !form.email.trim()}>
              Add member
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}