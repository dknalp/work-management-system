"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from "@tanstack/react-table"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ChevronsLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsRightIcon,
  InboxIcon,
} from "lucide-react"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Task, TaskStatus } from "./task-types"
import { createColumns } from "./task-columns"
import { TaskToolbar } from "./task-toolbar"

interface TaskTableProps {
  initialData: Task[]
  onRowClick?: (task: Task) => void
  onDelete?: (id: string) => void
  onDeleteMany?: (ids: string[]) => void
  onStatusChange?: (id: string, status: TaskStatus) => void
}

export function TaskTable({ initialData, onRowClick, onDelete, onDeleteMany, onStatusChange }: TaskTableProps) {
  const [tasks, setTasks] = useState<Task[]>(initialData)
  useEffect(() => {
    setTasks(initialData)
  }, [initialData])
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [globalFilter, setGlobalFilter] = useState("")
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })

  const handleDelete = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
    onDelete?.(id)
    toast.success("Task deleted", {
      description: `Task ${id} has been removed.`,
    })
  }, [onDelete])

  const handleDeleteSelected = useCallback(() => {
    const selectedIds = Object.keys(rowSelection)
    setTasks((prev) => prev.filter((t) => !selectedIds.includes(t.id)))
    onDeleteMany?.(selectedIds)
    setRowSelection({})
    toast.success(
      `${selectedIds.length} task${selectedIds.length > 1 ? "s" : ""} deleted`
    )
  }, [rowSelection, onDeleteMany])

  const handleStatusChange = useCallback(
    (id: string, status: TaskStatus) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status } : t)))
      onStatusChange?.(id, status)
    },
    [onStatusChange]
  )

  const columns = useMemo(
    () => createColumns(handleDelete, handleStatusChange),
    [handleDelete, handleStatusChange]
  )

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
      pagination,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
    globalFilterFn: (row, _columnId, filterValue: string) => {
      const search = filterValue.toLowerCase()
      return (
        row.original.title.toLowerCase().includes(search) ||
        row.original.assignee.toLowerCase().includes(search) ||
        row.original.id.toLowerCase().includes(search) ||
        row.original.tags.some((t) => t.toLowerCase().includes(search))
      )
    },
  })

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <TaskToolbar
        table={table}
        onDeleteSelected={handleDeleteSelected}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-border/60 bg-background shadow-sm">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow
                key={headerGroup.id}
                className="border-border/60 hover:bg-transparent"
              >
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className="py-3 text-xs font-semibold text-muted-foreground"
                    style={{
                      width:
                        header.column.getSize() !== 150
                          ? header.column.getSize()
                          : undefined,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                  className={cn(
                    "border-border/40 transition-colors hover:bg-muted/30 data-[state=selected]:bg-primary/5",
                    onRowClick && "cursor-pointer"
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-3">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-48 text-center"
                >
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <InboxIcon className="size-10 opacity-20" />
                    <p className="text-sm font-medium">No tasks found</p>
                    <p className="text-xs opacity-70">
                      Try adjusting your filters or add a new task.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length > 0 && (
            <span>{table.getFilteredSelectedRowModel().rows.length} of </span>
          )}
          <span>{table.getFilteredRowModel().rows.length} row(s)</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <Label
              htmlFor="rows-per-page"
              className="text-sm whitespace-nowrap text-muted-foreground"
            >
              Rows per page
            </Label>
            <Select
              value={`${table.getState().pagination.pageSize}`}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger
                size="sm"
                className="h-8 w-[70px]"
                id="rows-per-page"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {[10, 20, 30, 50].map((size) => (
                    <SelectItem key={size} value={`${size}`}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm font-medium whitespace-nowrap">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {Math.max(1, table.getPageCount())}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 sm:flex"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronsLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 sm:flex"
              onClick={() => table.setPageIndex(Math.max(0, table.getPageCount() - 1))}
              disabled={!table.getCanNextPage()}
            >
              <ChevronsRightIcon className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
