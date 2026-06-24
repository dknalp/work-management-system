"use client"

import React, { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { TeamMember } from "@/app/team/page"

interface MemberDialogProps {
  member: TeamMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (member: TeamMember) => void
  /** "add" = new member form, "edit" = edit existing. Inferred from `member` if omitted. */
  mode?: "add" | "edit"
}

const ROLES = [
  "Product Owner",
  "Engineering Manager",
  "Senior Developer",
  "Frontend Developer",
  "Backend Developer",
  "DevOps Engineer",
  "QA Engineer",
  "UI/UX Designer",
  "Data Analyst",
  "Scrum Master",
  "Marketing Manager",
  "HR Specialist",
]

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Analytics",
  "Marketing",
  "Human Resources",
]

const STATUSES: { value: TeamMember["status"]; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "away", label: "Away" },
  { value: "offline", label: "Offline" },
]

const emptyForm: Partial<TeamMember> = {
  name: "",
  email: "",
  phone: "",
  role: "",
  department: "",
  status: "active",
  joinedAt: new Date().toISOString().split("T")[0],
}

export function MemberDialog({
  member,
  open,
  onOpenChange,
  onSave,
  mode,
}: MemberDialogProps) {
  const isEdit = mode === "edit" || (mode === undefined && !!member)
  const [form, setForm] = useState<Partial<TeamMember>>(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      setErrors({})
      setForm(
        member
          ? { ...member }
          : { ...emptyForm, joinedAt: new Date().toISOString().split("T")[0] }
      )
    }
  }, [member, open])

  const set = <K extends keyof TeamMember>(key: K, value: TeamMember[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    if (errors[key])
      setErrors((prev) => {
        const n = { ...prev }
        delete n[key]
        return n
      })
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!form.name?.trim()) next.name = "Name is required."
    if (!form.email?.trim()) next.email = "Email is required."
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      next.email = "Enter a valid email."
    if (!form.role) next.role = "Role is required."
    if (!form.department) next.department = "Department is required."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const saved: TeamMember = {
      id: member?.id ?? Date.now().toString(),
      name: form.name!.trim(),
      email: form.email!.trim(),
      phone: form.phone?.trim() ?? "",
      role: form.role!,
      department: form.department!,
      status: form.status ?? "active",
      joinedAt: form.joinedAt ?? new Date().toISOString().split("T")[0],
    }

    onSave(saved)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Member" : "Add Member"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the team member's information below."
              : "Fill in the details to invite a new team member."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Jane Doe"
              className={
                errors.name
                  ? "border-destructive focus-visible:ring-destructive/20"
                  : ""
              }
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@worksync.io"
              className={
                errors.email
                  ? "border-destructive focus-visible:ring-destructive/20"
                  : ""
              }
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
            />
          </div>

          {/* Role + Department */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="role">
                Role <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.role ?? ""}
                onValueChange={(v) => set("role", v)}
              >
                <SelectTrigger
                  id="role"
                  className={errors.role ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-xs text-destructive">{errors.role}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="department">
                Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.department ?? ""}
                onValueChange={(v) => set("department", v)}
              >
                <SelectTrigger
                  id="department"
                  className={errors.department ? "border-destructive" : ""}
                >
                  <SelectValue placeholder="Select dept." />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.department && (
                <p className="text-xs text-destructive">{errors.department}</p>
              )}
            </div>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status ?? "active"}
              onValueChange={(v) => set("status", v as TeamMember["status"])}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">
              {isEdit ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
