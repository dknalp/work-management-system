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
import { SearchIcon, Trash2Icon, SlidersHorizontalIcon } from "lucide-react"
import { Task } from "@/types/task"

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
  const selectedCount = Object.keys(table.getState().rowSelection).length

  return (
    <div className="flex items-center gap-2">
      {/* Search */}
      <div className="relative flex-1">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={globalFilter}
          onChange={(e) => onGlobalFilterChange(e.target.value)}
          className="h-9 pl-9"
        />
      </div>

      {/* Bulk delete */}
      {selectedCount > 0 && (
        <Button
          variant="destructive"
          size="sm"
          className="gap-1.5"
          onClick={onDeleteSelected}
        >
          <Trash2Icon className="size-3.5" />
          Delete {selectedCount}
        </Button>
      )}

      {/* Column visibility */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <SlidersHorizontalIcon className="size-3.5" />
            Columns
            {table.getAllColumns().filter((c) => !c.getIsVisible()).length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
                {table.getAllColumns().filter((c) => !c.getIsVisible()).length}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            Toggle columns
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
  )
}