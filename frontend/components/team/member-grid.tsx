"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  MoreHorizontalIcon,
  Pencil,
  Trash2,
  Mail,
  BuildingIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TeamMember } from "@/app/team/page"

interface MemberGridProps {
  members: TeamMember[]
  onEdit: (member: TeamMember) => void
  onDelete: (id: string) => void
}

const avatarColors = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-indigo-500",
  "bg-cyan-500",
  "bg-pink-500",
  "bg-teal-500",
]

const statusConfig: Record<
  TeamMember["status"],
  { label: string; color: string; dot: string; ring: string }
> = {
  active: {
    label: "Active",
    color:
      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
    ring: "ring-emerald-500",
  },
  away: {
    label: "Away",
    color:
      "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
    ring: "ring-amber-500",
  },
  offline: {
    label: "Offline",
    color: "bg-zinc-500/15 text-zinc-500 dark:text-zinc-400 border-zinc-500/20",
    dot: "bg-zinc-400",
    ring: "ring-zinc-400",
  },
}

const departmentColors: Record<string, string> = {
  Engineering: "text-blue-600 dark:text-blue-400",
  Product: "text-violet-600 dark:text-violet-400",
  Design: "text-pink-600 dark:text-pink-400",
  Analytics: "text-teal-600 dark:text-teal-400",
  Marketing: "text-orange-600 dark:text-orange-400",
  "Human Resources": "text-rose-600 dark:text-rose-400",
}

export function MemberGrid({ members, onEdit, onDelete }: MemberGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {members.map((member) => {
        const initials = member.name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
        const colorIndex = member.name.charCodeAt(0) % avatarColors.length
        const statusCfg = statusConfig[member.status]
        const deptColor =
          departmentColors[member.department] ?? "text-muted-foreground"

        return (
          <div
            key={member.id}
            className="group relative rounded-2xl border border-border/50 bg-card/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-border hover:shadow-lg hover:shadow-black/5"
          >
            {/* Action Menu */}
            <div className="absolute top-3 right-3 z-10">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 bg-background/80 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-background"
                  >
                    <MoreHorizontalIcon className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => onEdit(member)}>
                    <Pencil className="mr-2 size-3.5" />
                    Edit Member
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => window.open(`mailto:${member.email}`)}
                  >
                    <Mail className="mr-2 size-3.5" />
                    Send Email
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(member.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 size-3.5" />
                    Remove Member
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex flex-col items-center gap-3 text-center">
              {/* Avatar with status ring */}
              <div className="relative">
                <div
                  className={cn(
                    "flex size-16 items-center justify-center rounded-full text-xl font-bold text-white shadow-md ring-4 ring-background",
                    avatarColors[colorIndex]
                  )}
                >
                  {initials}
                </div>
                {/* Status dot */}
                <span
                  className={cn(
                    "absolute right-0.5 bottom-0.5 size-3.5 rounded-full border-2 border-background",
                    statusCfg.dot
                  )}
                />
              </div>

              {/* Name & Role */}
              <div className="space-y-0.5">
                <p className="text-sm leading-tight font-semibold">
                  {member.name}
                </p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>

              {/* Status Badge */}
              <Badge
                variant="outline"
                className={cn(
                  "gap-1.5 border text-xs font-medium",
                  statusCfg.color
                )}
              >
                <span className={cn("size-1.5 rounded-full", statusCfg.dot)} />
                {statusCfg.label}
              </Badge>

              {/* Department */}
              <div
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  deptColor
                )}
              >
                <BuildingIcon className="size-3" />
                {member.department}
              </div>

              {/* Email */}
              <p className="w-full truncate px-1 text-xs text-muted-foreground">
                {member.email}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
