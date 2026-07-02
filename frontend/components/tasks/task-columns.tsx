"use client"

import { ColumnDef, Column, Row } from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  Trash2Icon,
  CheckIcon,
  CircleDotIcon,
  CircleIcon,
} from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { useAuth } from "@/contexts/auth-context"

type DeleteCellProps = {
  task: Task
  onDelete: () => void
}

function DeleteCell({ task, onDelete }: DeleteCellProps) {
  const canDeleteAny = usePermission("tasks:delete_any")
  const canDeleteOwn = usePermission("tasks:delete_own")
  const { user } = useAuth()
  const isOwn = task.assignees?.includes(user?.name ?? "")
  if (!canDeleteAny && !(canDeleteOwn && isOwn)) return null
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onDelete() }}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all group-hover/row:opacity-100 hover:bg-destructive/10 hover:text-destructive"
      aria-label="Delete task"
    >
      <Trash2Icon className="size-3.5" />
    </button>
  )
}
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Task, TaskStatus, TASK_STATUSES } from "@/types/task"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { format } from "date-fns"

function SortableHeader({
  column,
  label,
}: {
  column: Column<Task, unknown>
  label: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 gap-1 font-medium text-muted-foreground hover:text-foreground data-[sorted=true]:text-foreground"
      data-sorted={column.getIsSorted() !== false}
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      <ArrowUpDownIcon className="size-3.5 opacity-50" />
    </Button>
  )
}

type StatusCellProps = {
  row: Row<Task>
  onStatusChange?: (id: string, status: TaskStatus) => void
}

function StatusCell({ row, onStatusChange }: StatusCellProps) {
  const canEditAny = usePermission("tasks:edit_any")
  const canEditOwn = usePermission("tasks:edit_own")
  const { user } = useAuth()
  const isOwn = row.original.assignees?.includes(user?.name ?? "")
  const canEdit = canEditAny || (canEditOwn && isOwn)
  const status = row.original.status
  const cfg = statusConfig[status]

  if (!onStatusChange || !canEdit) {
    return (
      <Badge
        variant="outline"
        className={cn("h-6 gap-1.5 px-2 text-xs font-medium", cfg.className)}
      >
        {cfg.icon}
        {cfg.label}
      </Badge>
    )
  }
  return (
    <Select
      value={status}
      onValueChange={(val) => onStatusChange(row.original.id, val as TaskStatus)}
    >
      <SelectTrigger
        className={cn(
          "h-7 w-auto gap-1 border px-2 py-0 text-xs font-medium focus:ring-0 focus:ring-offset-0",
          cfg.className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {TASK_STATUSES.map((s) => {
          const c = statusConfig[s.value]
          return (
            <SelectItem key={s.value} value={s.value} className="text-xs">
              <span className="flex items-center gap-1.5">
                {c.icon}
                {c.label}
              </span>
            </SelectItem>
          )
        })}
      </SelectContent>
    </Select>
  )
}

const statusConfig: Record<
  Task["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  todo: {
    label: "Yapılacak",
    className: "border-border text-muted-foreground bg-muted/40",
    icon: <CircleIcon className="size-3" />,
  },
  "in-progress": {
    label: "Devam Ediyor",
    className:
      "border-blue-500/30 text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40",
    icon: <CircleDotIcon className="size-3" />,
  },
  done: {
    label: "Tamamlandı",
    className:
      "border-emerald-500/30 text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40",
    icon: <CheckIcon className="size-3" />,
  },
}

const priorityConfig: Record<
  Task["priority"],
  { label: string; className: string; dot: string }
> = {
  low: {
    label: "Düşük",
    className:
      "border-slate-400/30 text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/40",
    dot: "bg-slate-400",
  },
  medium: {
    label: "Orta",
    className:
      "border-amber-500/30 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
    dot: "bg-amber-500",
  },
  high: {
    label: "Yüksek",
    className:
      "border-rose-500/30 text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40",
    dot: "bg-rose-500",
  },
}

export function createColumns(
  onDelete: (id: string) => void,
  onStatusChange?: (id: string, status: TaskStatus) => void
): ColumnDef<Task>[] {
  return [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && "indeterminate")
          }
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Tümünü Seç"
          className="translate-y-px"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Satırı seç"
          className="translate-y-px"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column} label="Kimlik" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.id}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} label="Başlık" />,
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[440px] text-sm leading-snug font-medium">
          {row.original.title}
        </span>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column} label="Durum" />,
      cell: ({ row }) => <StatusCell row={row} onStatusChange={onStatusChange} />,
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <SortableHeader column={column} label="Öncelik" />
      ),
      cell: ({ row }) => {
        const cfg = priorityConfig[row.original.priority]
        return (
          <Badge
            variant="outline"
            className={cn(
              "h-6 gap-1.5 px-2 text-xs font-medium",
              cfg.className
            )}
          >
            <span className={cn("size-1.5 rounded-full", cfg.dot)} />
            {cfg.label}
          </Badge>
        )
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
      sortingFn: (rowA, rowB) => {
        const order: Record<Task["priority"], number> = {
          low: 0,
          medium: 1,
          high: 2,
        }
        return order[rowA.original.priority] - order[rowB.original.priority]
      },
    },
    {
      accessorKey: "assignees",
      header: ({ column }) => (
        <SortableHeader column={column} label="Sorumlular" />
      ),
      cell: ({ row }) => {
        const assignees = row.original.assignees ?? []
        if (assignees.length === 0) {
          return <span className="text-sm text-muted-foreground">—</span>
        }
        const visible = assignees.slice(0, 3)
        const overflow = assignees.length - 3
        return (
          <div className="flex items-center">
            <div className="flex -space-x-2">
              {visible.map((name) => {
                const initials = name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()
                return (
                  <div
                    key={name}
                    title={name}
                    className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background bg-primary/10 text-[10px] font-bold text-primary"
                  >
                    {initials}
                  </div>
                )
              })}
              {overflow > 0 && (
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-bold text-muted-foreground">
                  +{overflow}
                </div>
              )}
            </div>
            {assignees.length === 1 && (
              <span className="ml-2 text-sm whitespace-nowrap">{assignees[0]}</span>
            )}
          </div>
        )
      },
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <SortableHeader column={column} label="Son Tarih" />
      ),
      cell: ({ row }) => {
        const raw = row.original.dueDate
        if (!raw) return <span className="text-sm text-muted-foreground">—</span>
        const date = new Date(raw)
        if (isNaN(date.getTime())) return <span className="text-sm text-muted-foreground">—</span>
        const now = new Date()
        const isOverdue = date < now && row.original.status !== "done"
        return (
          <span
            className={cn(
              "text-sm whitespace-nowrap",
              isOverdue && "font-medium text-rose-600 dark:text-rose-400"
            )}
          >
            {format(date, "MMM d, yyyy")}
          </span>
        )
      },
    },
    {
      accessorKey: "createdAt",
      header: ({ column }) => (
        <SortableHeader column={column} label="Oluşturulma" />
      ),
      cell: ({ row }) => {
        const raw = row.original.createdAt
        if (!raw) return <span className="text-sm text-muted-foreground">—</span>
        const date = new Date(raw)
        if (isNaN(date.getTime())) return <span className="text-sm text-muted-foreground">—</span>
        return (
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {format(date, "MMM d, yyyy")}
          </span>
        )
      },
    },
    {
      accessorKey: "tags",
      header: "Etiketler",
      cell: ({ row }) => {
        const tags = row.original.tags
        const visible = tags.slice(0, 2)
        const overflow = tags.length - 2
        return (
          <div className="flex max-w-[180px] flex-wrap gap-1">
            {visible.map((tag) => (
              <Badge
                key={tag}
                variant="secondary"
                className="h-5 border-primary/10 bg-primary/5 px-1.5 text-[10px] font-medium text-primary"
              >
                {tag}
              </Badge>
            ))}
            {overflow > 0 && (
              <Badge
                variant="secondary"
                className="h-5 border-border bg-muted px-1.5 text-[10px] font-medium text-muted-foreground"
              >
                +{overflow}
              </Badge>
            )}
          </div>
        )
      },
      enableSorting: false,
    },
    {
      id: "actions",
      enableHiding: false,
      cell: ({ row }) => <DeleteCell task={row.original} onDelete={() => onDelete(row.original.id)} />,
    },
  ]
}
