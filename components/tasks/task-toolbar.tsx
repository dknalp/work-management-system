"use client"

import { Table } from "@tanstack/react-table"
import { SearchIcon, Trash2Icon, FilterIcon, XIcon } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { Task, TASK_STATUSES, TASK_PRIORITIES } from "./task-types"
import { cn } from "@/lib/utils"

interface TaskToolbarProps {
  table: Table<Task>
  onDeleteSelected: () => void
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
}

export function TaskToolbar({
  table,
  onDeleteSelected,
  globalFilter,
  onGlobalFilterChange,
}: TaskToolbarProps) {
  const selectedCount = table.getFilteredSelectedRowModel().rows.length
  const statusFilter =
    (table.getColumn("status")?.getFilterValue() as string[]) ?? []
  const priorityFilter =
    (table.getColumn("priority")?.getFilterValue() as string[]) ?? []

  const hasFilters =
    statusFilter.length > 0 ||
    priorityFilter.length > 0 ||
    globalFilter.length > 0

  const toggleStatus = (value: string) => {
    const current = statusFilter
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    table.getColumn("status")?.setFilterValue(next.length ? next : undefined)
  }

  const togglePriority = (value: string) => {
    const current = priorityFilter
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    table.getColumn("priority")?.setFilterValue(next.length ? next : undefined)
  }

  const clearAllFilters = () => {
    table.getColumn("status")?.setFilterValue(undefined)
    table.getColumn("priority")?.setFilterValue(undefined)
    onGlobalFilterChange("")
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:w-64">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="h-9 border-border/60 bg-muted/40 pl-9 focus-visible:bg-background focus-visible:ring-1 focus-visible:ring-primary/30"
          />
        </div>

        {/* Status Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-1.5 border-border/60",
                statusFilter.length > 0 &&
                  "border-primary/40 bg-primary/5 text-primary"
              )}
            >
              <FilterIcon className="size-3.5" />
              Status
              {statusFilter.length > 0 && (
                <Badge
                  variant="secondary"
                  className="size-5 justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground"
                >
                  {statusFilter.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">
              Filter by Status
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TASK_STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.value}
                checked={statusFilter.includes(s.value)}
                onCheckedChange={() => toggleStatus(s.value)}
                className="capitalize"
              >
                {s.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Priority Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "h-9 gap-1.5 border-border/60",
                priorityFilter.length > 0 &&
                  "border-primary/40 bg-primary/5 text-primary"
              )}
            >
              <FilterIcon className="size-3.5" />
              Priority
              {priorityFilter.length > 0 && (
                <Badge
                  variant="secondary"
                  className="size-5 justify-center rounded-full bg-primary p-0 text-[10px] font-bold text-primary-foreground"
                >
                  {priorityFilter.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            <DropdownMenuLabel className="text-xs">
              Filter by Priority
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {TASK_PRIORITIES.map((p) => (
              <DropdownMenuCheckboxItem
                key={p.value}
                checked={priorityFilter.includes(p.value)}
                onCheckedChange={() => togglePriority(p.value)}
                className="capitalize"
              >
                {p.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            onClick={clearAllFilters}
          >
            <XIcon className="size-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Delete selected */}
      {selectedCount > 0 && (
        <Button
          variant="destructive"
          size="sm"
          className="h-9 shrink-0 gap-1.5"
          onClick={onDeleteSelected}
        >
          <Trash2Icon className="size-3.5" />
          Delete {selectedCount} selected
        </Button>
      )}
    </div>
  )
}
