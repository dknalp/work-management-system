"use client"

import { ColumnDef, Column } from "@tanstack/react-table"
import {
  ArrowUpDownIcon,
  Trash2Icon,
  CheckIcon,
  CircleDotIcon,
  CircleIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Task } from "./task-types"
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

const statusConfig: Record<
  Task["status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  todo: {
    label: "Todo",
    className: "border-border text-muted-foreground bg-muted/40",
    icon: <CircleIcon className="size-3" />,
  },
  "in-progress": {
    label: "In Progress",
    className:
      "border-blue-500/30 text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/40",
    icon: <CircleDotIcon className="size-3" />,
  },
  done: {
    label: "Done",
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
    label: "Low",
    className:
      "border-slate-400/30 text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/40",
    dot: "bg-slate-400",
  },
  medium: {
    label: "Medium",
    className:
      "border-amber-500/30 text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/40",
    dot: "bg-amber-500",
  },
  high: {
    label: "High",
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
          aria-label="Select All"
          className="translate-y-px"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          className="translate-y-px"
        />
      ),
      enableSorting: false,
      enableHiding: false,
      size: 40,
    },
    {
      accessorKey: "id",
      header: ({ column }) => <SortableHeader column={column} label="ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.original.id}
        </span>
      ),
      size: 100,
    },
    {
      accessorKey: "title",
      header: ({ column }) => <SortableHeader column={column} label="Title" />,
      cell: ({ row }) => (
        <span className="line-clamp-2 max-w-[440px] text-sm leading-snug font-medium">
          {row.original.title}
        </span>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column} label="Status" />,
      cell: ({ row }) => {
        const cfg = statusConfig[row.original.status]
        return (
          <Badge
            variant="outline"
            className={cn(
              "h-6 gap-1.5 px-2 text-xs font-medium",
              cfg.className
            )}
          >
            {cfg.icon}
            {cfg.label}
          </Badge>
        )
      },
      filterFn: (row, id, value: string[]) => value.includes(row.getValue(id)),
    },
    {
      accessorKey: "priority",
      header: ({ column }) => (
        <SortableHeader column={column} label="Priority" />
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
      accessorKey: "assignee",
      header: ({ column }) => (
        <SortableHeader column={column} label="Assignee" />
      ),
      cell: ({ row }) => {
        const name = row.original.assignee
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
        return (
          <div className="flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
              {initials}
            </div>
            <span className="text-sm whitespace-nowrap">{name}</span>
          </div>
        )
      },
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <SortableHeader column={column} label="Deadline" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.dueDate)
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
        <SortableHeader column={column} label="Created At" />
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return (
          <span className="text-sm whitespace-nowrap text-muted-foreground">
            {format(date, "MMM d, yyyy")}
          </span>
        )
      },
    },
    {
      accessorKey: "tags",
      header: "Tags",
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
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(row.original.id)}
          aria-label="Delete task"
        >
          <Trash2Icon className="size-4" />
        </Button>
      ),
    },
  ]
}
