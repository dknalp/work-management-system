"use client"

import { Table } from "@tanstack/react-table"
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
import { SearchIcon, Trash2Icon, SlidersHorizontalIcon, XIcon } from "lucide-react"
import { Task, TaskStatus, TaskPriority } from "@/types/task"
import { usePermission } from "@/hooks/use-permission"
import { cn } from "@/lib/utils"

interface TaskToolbarProps {
  table: Table<Task>
  onDeleteSelected: () => void
  globalFilter: string
  onGlobalFilterChange: (value: string) => void
}

const STATUS_FILTERS: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Yapılacak" },
  { value: "in-progress", label: "Devam" },
  { value: "done", label: "Bitti" },
]

const PRIORITY_FILTERS: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Düşük" },
  { value: "medium", label: "Orta" },
  { value: "high", label: "Yüksek" },
]

export function TaskToolbar({
  table,
  onDeleteSelected,
  globalFilter,
  onGlobalFilterChange,
}: TaskToolbarProps) {
  const selectedCount = Object.keys(table.getState().rowSelection).length
  const canDeleteAny = usePermission("tasks:delete_any")

  const statusFilter = (table.getColumn("status")?.getFilterValue() as string[] | undefined) ?? []
  const priorityFilter = (table.getColumn("priority")?.getFilterValue() as string[] | undefined) ?? []

  function toggleStatusFilter(value: TaskStatus) {
    const col = table.getColumn("status")
    if (!col) return
    const curr = (col.getFilterValue() as string[] | undefined) ?? []
    col.setFilterValue(
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
    )
  }

  function togglePriorityFilter(value: TaskPriority) {
    const col = table.getColumn("priority")
    if (!col) return
    const curr = (col.getFilterValue() as string[] | undefined) ?? []
    col.setFilterValue(
      curr.includes(value) ? curr.filter((v) => v !== value) : [...curr, value]
    )
  }

  function clearAllFilters() {
    table.getColumn("status")?.setFilterValue(undefined)
    table.getColumn("priority")?.setFilterValue(undefined)
    onGlobalFilterChange("")
  }

  const hasActiveFilters = statusFilter.length > 0 || priorityFilter.length > 0 || globalFilter.length > 0

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Görev ara..."
            value={globalFilter}
            onChange={(e) => onGlobalFilterChange(e.target.value)}
            className="h-9 pl-9"
          />
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearAllFilters}>
            <XIcon className="size-3.5" />
            Temizle
          </Button>
        )}

        {/* Bulk delete */}
        {selectedCount > 0 && canDeleteAny && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            onClick={onDeleteSelected}
          >
            <Trash2Icon className="size-3.5" />
            {selectedCount} Sil
          </Button>
        )}

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontalIcon className="size-3.5" />
              Sütunlar
              {table.getAllColumns().filter((c) => !c.getIsVisible()).length > 0 && (
                <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                  {table.getAllColumns().filter((c) => !c.getIsVisible()).length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Sütunları değiştir
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((col) => col.getCanHide())
              .map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={col.getIsVisible()}
                  onCheckedChange={(v) => col.toggleVisibility(!!v)}
                  className="capitalize text-sm"
                >
                  {col.id.replace(/([A-Z])/g, " $1").trim()}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Durum:</span>
        {STATUS_FILTERS.map((s) => (
          <button
            key={s.value}
            onClick={() => toggleStatusFilter(s.value)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              statusFilter.includes(s.value)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}

        <span className="ml-2 text-xs text-muted-foreground">Öncelik:</span>
        {PRIORITY_FILTERS.map((p) => (
          <button
            key={p.value}
            onClick={() => togglePriorityFilter(p.value)}
            className={cn(
              "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
              priorityFilter.includes(p.value)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}