"use client"

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  closestCorners,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { createPortal } from "react-dom"
import { KanbanColumn, Column } from "./kanban-column"
import { KanbanCard, Task } from "./kanban-card"
import { TaskStatus } from "@/types/task"
import { toast } from "sonner"
import { GripVertical, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { apiClient } from "@/lib/api"
import { Skeleton } from "@/components/ui/skeleton"

const defaultColumns: Column[] = [
  { id: "todo", title: "Yapılacak" },
  { id: "in-progress", title: "Devam Ediyor" },
  { id: "done", title: "Tamamlandı" },
]

interface KanbanBoardProps {
  onAddColumn?: (addColumnFn: (title: string) => void) => void
  storageKey?: string
  pipelineId?: string
}

// ─── Sortable column wrapper with rename + delete controls ───────────────────

function SortableColumnWrapper({
  column,
  tasks,
  columns,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
  onDuplicateCard,
  onRename,
  onDelete,
}: {
  column: Column
  tasks: Task[]
  columns: Column[]
  onAddCard: (columnId: string, title: string) => void
  onDeleteCard: (taskId: string) => void
  onUpdateCard: (taskId: string, updates: Partial<Task>) => void
  onDuplicateCard: (taskId: string) => void
  onRename: (id: string, newTitle: string) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(column.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      setEditValue(column.title)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing, column.title])

  const commitRename = () => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== column.title) onRename(column.id, trimmed)
    setEditing(false)
  }

  const cancelRename = () => {
    setEditing(false)
  }

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, data: { type: "Column" } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const colHeaderSlot = (
    <div className="flex items-center gap-1 mb-3">
      {/* drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/30 hover:text-muted-foreground transition-colors shrink-0 -ml-1"
        tabIndex={-1}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") cancelRename()
            }}
            className="h-6 text-sm font-semibold px-1.5 py-0 flex-1"
          />
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={commitRename}>
            <Check className="h-3 w-3 text-green-500" />
          </Button>
          <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={cancelRename}>
            <X className="h-3 w-3 text-muted-foreground" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between flex-1 min-w-0 group/header">
          <span
            className="font-semibold text-sm truncate cursor-default select-none"
            onDoubleClick={() => !isDragging && setEditing(true)}
          >
            {column.title}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground">({tasks.length})</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover/header:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Yeniden Adlandır
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => onDelete(column.id)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  Sütunu Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div ref={setNodeRef} style={style} className="w-72 shrink-0 flex flex-col">
      <KanbanColumn
        column={column}
        tasks={tasks}
        columns={columns}
        onAddCard={onAddCard}
        onDeleteCard={onDeleteCard}
        onUpdateCard={onUpdateCard}
        onDuplicateCard={onDuplicateCard}
        headerSlot={colHeaderSlot}
      />
    </div>
  )
}

// ─── Add column inline form ───────────────────────────────────────────────────

function AddColumnInline({ onAdd }: { onAdd: (title: string) => void }) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const commit = () => {
    const trimmed = value.trim()
    if (trimmed) {
      onAdd(trimmed)
      setValue("")
      setOpen(false)
    }
  }

  useEffect(() => {
    if (open) {
      // Use setTimeout to allow the render to complete before focusing
      const id = setTimeout(() => inputRef.current?.focus(), 0)
      return () => clearTimeout(id)
    }
  }, [open])

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "w-72 shrink-0 flex items-center gap-2 px-4 py-3 rounded-2xl",
          "border-2 border-dashed border-border/40 text-muted-foreground text-sm",
          "hover:border-border hover:text-foreground transition-colors"
        )}
      >
        + Sütun Ekle
      </button>
    )
  }

  return (
    <div className="w-72 shrink-0 rounded-2xl border border-border/50 bg-muted/30 p-4 flex flex-col gap-2">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") { setOpen(false); setValue("") }
        }}
        placeholder="Sütun başlığı…"
        className="h-8 text-sm"
      />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 px-3 text-xs flex-1" onClick={commit} disabled={!value.trim()}>
          Ekle
        </Button>
        <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setOpen(false); setValue("") }}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Loading skeleton ────────────────────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto">
      {[1, 2, 3].map((i) => (
        <div key={i} className="w-72 shrink-0 flex flex-col gap-3 rounded-2xl border border-border/50 bg-muted/30 p-4">
          <Skeleton className="h-6 w-3/4 rounded-md" />
          {[1, 2, 3].map((j) => (
            <Skeleton key={j} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── Drag overlay animation ──────────────────────────────────────────────────

const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: "0.5" } },
  }),
}

// ─── Board state shape persisted to / loaded from the backend blob ───────────

interface PersistedBoardState {
  columns: Column[]
  tasks: Record<string, Task[]>
}

// ─── KanbanBoard ─────────────────────────────────────────────────────────────

export function KanbanBoard({ onAddColumn, storageKey, pipelineId }: KanbanBoardProps) {
  // ── State ─────────────────────────────────────────────────────────────────

  const [columns, setColumns] = useState<Column[]>(defaultColumns)
  const [tasks, setTasks] = useState<Record<string, Task[]>>({})
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!pipelineId)

  /**
   * Ref to the last-committed board state used for optimistic-revert on save failure.
   * We snapshot before every write so a failed PUT can restore the previous state.
   */
  const lastSavedRef = useRef<PersistedBoardState>({ columns: defaultColumns, tasks: {} })

  // ── Backend persistence helpers ──────────────────────────────────────────

  /**
   * Persists the current board state to `PUT /kanban/{pipelineId}`.
   * Called after every mutation when `pipelineId` is set.
   * On failure, reverts to the last saved snapshot and shows a toast.
   */
  const persistBoard = useCallback(
    async (nextColumns: Column[], nextTasks: Record<string, Task[]>) => {
      if (!pipelineId) return

      const snapshot = lastSavedRef.current
      lastSavedRef.current = { columns: nextColumns, tasks: nextTasks }

      try {
        const state: PersistedBoardState = { columns: nextColumns, tasks: nextTasks }
        await apiClient.put(`/kanban/${pipelineId}`, { pipeline_id: pipelineId, state })
      } catch {
        // Revert to the last successfully saved state
        setColumns(snapshot.columns)
        setTasks(snapshot.tasks)
        lastSavedRef.current = snapshot
        toast.error("Pano kaydedilemedi. Değişiklikler geri alındı.")
      }
    },
    [pipelineId]
  )

  // ── Load board from backend on mount (when pipelineId is provided) ────────

  useEffect(() => {
    if (!pipelineId) return

    async function loadBoard() {
      try {
        const response = await apiClient.get<{ state: PersistedBoardState | null }>(
          `/kanban/${pipelineId}`
        )
        if (response?.state?.columns && response.state.tasks) {
          setColumns(response.state.columns)
          setTasks(response.state.tasks)
          lastSavedRef.current = response.state
        }
      } catch {
        toast.error("Pano yüklenemedi.")
      } finally {
        setLoading(false)
      }
    }

    loadBoard()
  }, [pipelineId])

  // Expose addColumn to the parent via callback ref
  const addColumn = useCallback(
    (title: string) => {
      const newCol: Column = { id: crypto.randomUUID(), title }
      const nextColumns = [...columns, newCol]
      const nextTasks = { ...tasks, [newCol.id]: [] }
      setColumns(nextColumns)
      setTasks(nextTasks)
      persistBoard(nextColumns, nextTasks)
    },
    [columns, tasks, persistBoard]
  )

  useEffect(() => {
    onAddColumn?.(addColumn)
  }, [onAddColumn, addColumn])

  // ── DnD sensors ──────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  // ── Derived data ─────────────────────────────────────────────────────────

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns])

  const deleteTargetColumn = useMemo(
    () => columns.find((c) => c.id === deleteTarget) ?? null,
    [columns, deleteTarget]
  )

  const deleteTargetTaskCount = useMemo(
    () => (deleteTarget ? (tasks[deleteTarget]?.length ?? 0) : 0),
    [tasks, deleteTarget]
  )

  const hasOtherColumns = columns.length > 1

  // ── Column operations ────────────────────────────────────────────────────

  const renameColumn = useCallback(
    (id: string, newTitle: string) => {
      const nextColumns = columns.map((c) => (c.id === id ? { ...c, title: newTitle } : c))
      setColumns(nextColumns)
      persistBoard(nextColumns, tasks)
    },
    [columns, tasks, persistBoard]
  )

  const requestDeleteColumn = useCallback((id: string) => {
    setDeleteTarget(id)
  }, [])

  const confirmDeleteColumn = useCallback(() => {
    if (!deleteTarget) return

    const targetTasks = tasks[deleteTarget] ?? []
    const otherColumns = columns.filter((c) => c.id !== deleteTarget)

    let nextTasks: Record<string, Task[]>

    if (targetTasks.length > 0 && otherColumns.length > 0) {
      // Move orphaned cards to the first remaining column
      const firstColId = otherColumns[0].id
      nextTasks = {
        ...tasks,
        [firstColId]: [...(tasks[firstColId] ?? []), ...targetTasks],
      }
      delete nextTasks[deleteTarget]
    } else {
      nextTasks = { ...tasks }
      delete nextTasks[deleteTarget]
    }

    setColumns(otherColumns)
    setTasks(nextTasks)
    setDeleteTarget(null)
    persistBoard(otherColumns, nextTasks)
  }, [deleteTarget, columns, tasks, persistBoard])

  // ── Card operations ──────────────────────────────────────────────────────

  const addCard = useCallback(
    (columnId: string, title: string) => {
      const newTask: Task = {
        id: crypto.randomUUID(),
        title,
        status: columnId as TaskStatus,
        priority: "medium",
        tags: [],
        assignees: [],
        dueDate: "",
        description: "",
        createdAt: new Date().toISOString().slice(0, 10),
      }
      const nextTasks = {
        ...tasks,
        [columnId]: [...(tasks[columnId] ?? []), newTask],
      }
      setTasks(nextTasks)
      persistBoard(columns, nextTasks)
    },
    [tasks, columns, persistBoard]
  )

  const deleteCard = useCallback(
    (taskId: string) => {
      const nextTasks = Object.fromEntries(
        Object.entries(tasks).map(([colId, colTasks]) => [
          colId,
          colTasks.filter((t) => t.id !== taskId),
        ])
      )
      setTasks(nextTasks)
      persistBoard(columns, nextTasks)
    },
    [tasks, columns, persistBoard]
  )

  const updateCard = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      const nextTasks = Object.fromEntries(
        Object.entries(tasks).map(([colId, colTasks]) => [
          colId,
          colTasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t)),
        ])
      )
      setTasks(nextTasks)
      persistBoard(columns, nextTasks)
    },
    [tasks, columns, persistBoard]
  )

  const duplicateCard = useCallback(
    (taskId: string) => {
      let sourceColId: string | null = null
      let sourceTask: Task | null = null

      for (const [colId, colTasks] of Object.entries(tasks)) {
        const found = colTasks.find((t) => t.id === taskId)
        if (found) {
          sourceColId = colId
          sourceTask = found
          break
        }
      }

      if (!sourceTask || !sourceColId) return

      const duplicate: Task = { ...sourceTask, id: crypto.randomUUID() }
      const nextTasks = {
        ...tasks,
        [sourceColId]: [...(tasks[sourceColId] ?? []), duplicate],
      }
      setTasks(nextTasks)
      persistBoard(columns, nextTasks)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, columns, persistBoard]
  )

  // ── DnD handlers ─────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event
      if (active.data.current?.type === "Task") {
        setActiveTask(active.data.current.task as Task)
      }
    },
    []
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      if (active.data.current?.type !== "Task") return

      const activeTask = active.data.current.task as Task
      const overType = over.data.current?.type

      // Determine the target column id
      let toColId: string
      if (overType === "Column") {
        toColId = over.id as string
      } else if (overType === "Task") {
        const overTask = over.data.current?.task as Task
        toColId = overTask.columnId
      } else {
        return
      }

      if (activeTask.status === toColId) return

      // Move card across columns in local state (live preview during drag)
      setTasks((prev) => {
        const fromColId = activeTask.status
        const fromColTasks = (prev[fromColId] ?? []).filter(
          (t) => t.id !== activeTask.id
        )
        const toColTasks = [
          ...(prev[toColId] ?? []),
          { ...activeTask, status: toColId as TaskStatus },
        ]
        return { ...prev, [fromColId]: fromColTasks, [toColId]: toColTasks }
      })

      // Update the active task ref so subsequent dragOver events use the new status
      setActiveTask((prev) =>
        prev ? { ...prev, status: toColId as TaskStatus } : null
      )
    },
    []
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveTask(null)

      if (!over || active.id === over.id) return

      if (active.data.current?.type === "Column") {
        // Reorder columns
        const oldIndex = columns.findIndex((c) => c.id === active.id)
        const newIndex = columns.findIndex((c) => c.id === over.id)
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return
        const nextColumns = arrayMove(columns, oldIndex, newIndex)
        setColumns(nextColumns)
        persistBoard(nextColumns, tasks)
        return
      }

      if (active.data.current?.type === "Task") {
        // Reorder cards within the same column
        const activeTaskData = active.data.current.task as Task
        // Task.status holds the column id (the column this card currently belongs to)
        const colId = activeTaskData.status
        const colTasks = tasks[colId] ?? []
        const oldIndex = colTasks.findIndex((t) => t.id === active.id)
        const newIndex = colTasks.findIndex((t) => t.id === over.id)

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const nextColTasks = arrayMove(colTasks, oldIndex, newIndex)
          const nextTasks = { ...tasks, [colId]: nextColTasks }
          setTasks(nextTasks)
          persistBoard(columns, nextTasks)
        } else {
          // Cross-column move already done in handleDragOver — just persist
          persistBoard(columns, tasks)
        }
      }
    },
    [columns, tasks, persistBoard]
  )

  // ── Render ───────────────────────────────────────────────────────────────

  if (loading) return <KanbanSkeleton />

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {columns.map((column) => (
              <SortableColumnWrapper
                key={column.id}
                column={column}
                tasks={tasks[column.id] ?? []}
                columns={columns}
                onAddCard={addCard}
                onDeleteCard={deleteCard}
                onUpdateCard={updateCard}
                onDuplicateCard={duplicateCard}
                onRename={renameColumn}
                onDelete={requestDeleteColumn}
              />
            ))}
          </SortableContext>

          <AddColumnInline onAdd={addColumn} />
        </div>

        {typeof document !== "undefined" &&
          createPortal(
            <DragOverlay dropAnimation={dropAnimation}>
              {activeTask ? <KanbanCard task={activeTask} isOverlay /> : null}
            </DragOverlay>,
            document.body
          )}
      </DndContext>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sütunu Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTargetColumn?.title}</strong> sütununu silmek istediğinizden emin misiniz?
              {deleteTargetTaskCount > 0 && (
                <span className="block mt-1">
                  {hasOtherColumns
                    ? `Bu sütundaki ${deleteTargetTaskCount} kart ilk sütuna taşınacak.`
                    : `Bu sütundaki ${deleteTargetTaskCount} kart silinecek.`}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteColumn}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}