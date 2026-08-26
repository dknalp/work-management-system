"use client"

/**
 * KanbanBoard component — the unified task management board.
 *
 * This is the single implementation of the kanban board.  It uses real Task
 * objects from the task context (Firestore-backed) rather than maintaining a
 * separate local task store.
 *
 * Board state (columns + task ordering) is persisted to the backend via
 * ``PUT /kanban/:pipelineId``.  The stored blob contains only:
 *   - columns: Column[]           — the column definitions
 *   - task_order: Record<columnId, string[]>  — ordered task IDs per column
 *
 * The actual task data (title, priority, assignees, etc.) always comes from
 * the task context.  The board is just a view with drag-drop ordering.
 *
 * When a task is created from the board:
 *   1. A real task is created in Firestore via the task context.
 *   2. The task ID is appended to the correct column in task_order.
 *   3. The board state is saved.
 *
 * When a task is deleted from the board:
 *   1. The real task is deleted from Firestore via the task context.
 *   2. The task ID is removed from task_order.
 *   3. The board state is saved.
 */

import React, {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
} from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
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
import { KanbanCard } from "./kanban-card"
import { Task, TaskStatus } from "@/types/task"
import { toast } from "sonner"
import {
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Check,
  X,
} from "lucide-react"
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
import { useTasks } from "@/contexts/task-context"

// ── Board state shape stored in Firestore via /kanban/:pipelineId ─────────────

/**
 * What we persist to the kanban backend endpoint.
 * task_order maps columnId → ordered array of task IDs.
 * This replaces the old embedded-task-objects approach.
 */
interface PersistedBoardState {
  columns: Column[]
  /** Maps column ID → ordered list of Firestore task IDs. */
  task_order: Record<string, string[]>
}

// ── Default columns when no pipeline is bound ────────────────────────────────

const defaultColumns: Column[] = [
  { id: "todo", title: "Yapılacak" },
  { id: "in-progress", title: "Devam Ediyor" },
  { id: "done", title: "Tamamlandı" },
]

// ── Props ─────────────────────────────────────────────────────────────────────

interface KanbanBoardProps {
  /** If provided, board state is persisted to the backend under this pipeline ID. */
  pipelineId?: string
  /** Callback that exposes the addColumn function to the parent. */
  onAddColumn?: (addColumnFn: (title: string) => void) => void
}

// ── Draggable column header ───────────────────────────────────────────────────

function SortableColumnHeader({
  column,
  onRename,
  onDelete,
  disabled,
}: {
  column: Column
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
  disabled: boolean
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `col-drag-${column.id}`, data: { type: "ColumnDrag" } })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(column.title)

  function commit() {
    const trimmed = draft.trim()
    if (trimmed && trimmed !== column.title) onRename(column.id, trimmed)
    setEditing(false)
  }

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1 mb-2 min-w-0">
      {!disabled && (
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-0.5 rounded"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {editing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <Input
            autoFocus
            className="h-7 text-sm font-medium"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit()
              if (e.key === "Escape") {
                setDraft(column.title)
                setEditing(false)
              }
            }}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={commit}>
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              setDraft(column.title)
              setEditing(false)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <span className="text-sm font-medium flex-1 truncate">{column.title}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Yeniden Adlandır
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(column.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  )
}

// ── Main board component ──────────────────────────────────────────────────────

export function KanbanBoard({ pipelineId, onAddColumn }: KanbanBoardProps) {
  const {
    tasks: allTasks,
    createTask,
    updateTask,
    deleteTask,
    logActivity,
  } = useTasks()

  // columns is the ordered list of column definitions.
  const [columns, setColumns] = useState<Column[]>(defaultColumns)
  // task_order maps columnId → ordered array of task IDs from Firestore.
  const [taskOrder, setTaskOrder] = useState<Record<string, string[]>>(
    () => Object.fromEntries(defaultColumns.map((c) => [c.id, []]))
  )

  // Start in loading state — board data is always fetched asynchronously on mount.
  const [loading, setLoading] = useState(!!pipelineId)
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [activeColumn, setActiveColumn] = useState<Column | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  // Guards the createPortal call — document.body is undefined during SSR/prerender.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  // Debounce ref for board persistence — we persist 800ms after the last change.
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<PersistedBoardState | null>(null)

  // ── Board persistence ────────────────────────────────────────────────────────

  /**
   * Persist the board state to the backend.  Skips the write when pipelineId
   * is absent — the board still works locally, it just won't survive a reload.
   */
  const persistBoard = useCallback(
    (nextColumns: Column[], nextOrder: Record<string, string[]>) => {
      if (!pipelineId) return

      const state: PersistedBoardState = {
        columns: nextColumns,
        task_order: nextOrder,
      }

      if (persistTimer.current) clearTimeout(persistTimer.current)
      persistTimer.current = setTimeout(async () => {
        try {
          await apiClient.put(`/kanban/${pipelineId}`, {
            pipeline_id: pipelineId,
            state,
          })
          lastSavedRef.current = state
        } catch {
          toast.error("Pano kaydedilemedi.")
        }
      }, 800)
    },
    [pipelineId]
  )

  // ── Load board state on mount ────────────────────────────────────────────────

  useEffect(() => {
    if (!pipelineId) return

    async function loadBoard() {
      try {
        const response = await apiClient.get<{ state: PersistedBoardState | null }>(
          `/kanban/${pipelineId}`
        )

        if (response?.state?.columns) {
          setColumns(response.state.columns)

          // Migrate old board state: old format stored task objects under ``tasks``,
          // new format stores task IDs under ``task_order``.
          const savedState = response.state as Record<string, unknown>
          if (savedState.task_order) {
            setTaskOrder(savedState.task_order)
          } else if (savedState.tasks) {
            // Legacy migration: extract IDs from embedded task objects.
            const migratedOrder: Record<string, string[]> = {}
            for (const [colId, colTasks] of Object.entries(
              savedState.tasks as Record<string, Array<{ id: string }>>
            )) {
              migratedOrder[colId] = (colTasks ?? []).map((t) => t.id)
            }
            setTaskOrder(migratedOrder)
            // Immediately persist the migrated format so we don't do this again.
            const migrated: PersistedBoardState = {
              columns: response.state.columns,
              task_order: migratedOrder,
            }
            await apiClient.put(`/kanban/${pipelineId}`, {
              pipeline_id: pipelineId,
              state: migrated,
            })
          }

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

  // ── Derived: tasks organised by column ──────────────────────────────────────

  /**
   * Build a map of columnId → Task[] using the task_order IDs and the real
   * Task objects from the task context.  Tasks that exist in the context but
   * are not in any column order are placed in the column whose ID matches
   * their status field (auto-placement for tasks created outside the board).
   */
  const tasksById = useMemo(
    () => new Map(allTasks.map((t) => [t.id, t])),
    [allTasks]
  )

  const tasksByColumn = useMemo<Record<string, Task[]>>(() => {
    const result: Record<string, Task[]> = {}

    // Populate from task_order first (respects manual ordering).
    for (const col of columns) {
      const ids = taskOrder[col.id] ?? []
      result[col.id] = ids
        .map((id) => tasksById.get(id))
        .filter((t): t is Task => t !== undefined)
    }

    // Auto-place tasks that exist in Firestore but aren't in any column order.
    const placedIds = new Set(
      columns.flatMap((c) => taskOrder[c.id] ?? [])
    )
    for (const task of allTasks) {
      if (placedIds.has(task.id)) continue
      // Find the column whose ID matches the task's status.
      const targetColId =
        columns.find((c) => c.id === task.status)?.id ?? columns[0]?.id
      if (!targetColId) continue
      result[targetColId] = [...(result[targetColId] ?? []), task]
    }

    return result
  }, [columns, taskOrder, tasksById, allTasks])

  // ── addColumn (exposed to parent via onAddColumn) ──────────────────────────

  const addColumn = useCallback(
    (title: string) => {
      const newCol: Column = { id: crypto.randomUUID(), title }
      const nextColumns = [...columns, newCol]
      const nextOrder = { ...taskOrder, [newCol.id]: [] }
      setColumns(nextColumns)
      setTaskOrder(nextOrder)
      persistBoard(nextColumns, nextOrder)
    },
    [columns, taskOrder, persistBoard]
  )

  useEffect(() => {
    onAddColumn?.(addColumn)
  }, [onAddColumn, addColumn])

  // ── Column operations ────────────────────────────────────────────────────────

  const renameColumn = useCallback(
    (id: string, newTitle: string) => {
      const nextColumns = columns.map((c) =>
        c.id === id ? { ...c, title: newTitle } : c
      )
      setColumns(nextColumns)
      persistBoard(nextColumns, taskOrder)
    },
    [columns, taskOrder, persistBoard]
  )

  const requestDeleteColumn = useCallback((id: string) => {
    setDeleteTarget(id)
  }, [])

  const confirmDeleteColumn = useCallback(async () => {
    if (!deleteTarget) return

    const idsInColumn = taskOrder[deleteTarget] ?? []
    const otherColumns = columns.filter((c) => c.id !== deleteTarget)

    // Move orphaned task IDs to the first remaining column.
    const nextOrder = { ...taskOrder }
    delete nextOrder[deleteTarget]

    if (idsInColumn.length > 0 && otherColumns.length > 0) {
      const firstColId = otherColumns[0].id
      nextOrder[firstColId] = [...(nextOrder[firstColId] ?? []), ...idsInColumn]
    }

    setColumns(otherColumns)
    setTaskOrder(nextOrder)
    setDeleteTarget(null)
    persistBoard(otherColumns, nextOrder)
  }, [deleteTarget, columns, taskOrder, persistBoard])

  // ── Card operations ──────────────────────────────────────────────────────────

  const addCard = useCallback(
    async (columnId: string, title: string) => {
      // Map the column ID to a task status — if the column ID is a known status
      // value, use it directly.  Otherwise default to "todo".
      const statusMap: Record<string, TaskStatus> = {
        todo: "todo",
        "in-progress": "in-progress",
        done: "done",
      }
      const status: TaskStatus = statusMap[columnId] ?? "todo"

      const created = await createTask({
        title,
        status,
        priority: "medium",
        assignees: [],
        tags: [],
        project_id: undefined,
      })

      if (!created) return // createTask already toasted the error.

      const nextOrder = {
        ...taskOrder,
        [columnId]: [...(taskOrder[columnId] ?? []), created.id],
      }
      setTaskOrder(nextOrder)
      persistBoard(columns, nextOrder)

      logActivity({
        type: "task_created",
        task_id: created.id,
        task_title: created.title,
        detail: `Added to column "${columns.find((c) => c.id === columnId)?.title ?? columnId}"`,
      })
    },
    [columns, taskOrder, persistBoard, createTask, logActivity]
  )

  const deleteCard = useCallback(
    async (taskId: string) => {
      const success = await deleteTask(taskId)
      if (!success) return

      const nextOrder = Object.fromEntries(
        Object.entries(taskOrder).map(([colId, ids]) => [
          colId,
          ids.filter((id) => id !== taskId),
        ])
      )
      setTaskOrder(nextOrder)
      persistBoard(columns, nextOrder)
    },
    [taskOrder, columns, persistBoard, deleteTask]
  )

  const updateCard = useCallback(
    async (taskId: string, data: Partial<Task>) => {
      await updateTask(taskId, data)
      // No need to update taskOrder — the task ID stays the same.
    },
    [updateTask]
  )

  // ── DnD sensors ──────────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const columnIds = useMemo(() => columns.map((c) => c.id), [columns])

  // ── Drag handlers ────────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const type = event.active.data.current?.type as string | undefined
      if (type === "Task") {
        setActiveTask(event.active.data.current?.task as Task)
      } else if (type === "Column") {
        setActiveColumn(event.active.data.current?.column as Column)
      }
    },
    []
  )

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event
      if (!over) return

      const activeType = active.data.current?.type as string
      const overType = over.data.current?.type as string

      if (activeType !== "Task") return

      const activeTaskObj = active.data.current?.task as Task

      let toColId: string
      if (overType === "Column") {
        toColId = over.id as string
      } else if (overType === "Task") {
        const overTask = over.data.current?.task as Task
        // Find which column this task belongs to.
        toColId =
          Object.entries(taskOrder).find(([, ids]) =>
            ids.includes(overTask.id)
          )?.[0] ?? activeTaskObj.status
      } else {
        return
      }

      const fromColId =
        Object.entries(taskOrder).find(([, ids]) =>
          ids.includes(activeTaskObj.id)
        )?.[0] ?? activeTaskObj.status

      if (fromColId === toColId) return

      setTaskOrder((prev) => {
        const fromIds = (prev[fromColId] ?? []).filter(
          (id) => id !== activeTaskObj.id
        )
        const toIds = [...(prev[toColId] ?? []), activeTaskObj.id]
        return { ...prev, [fromColId]: fromIds, [toColId]: toIds }
      })
    },
    [taskOrder]
  )

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setActiveTask(null)
      setActiveColumn(null)

      if (!over) return

      const activeType = active.data.current?.type as string
      const overType = over.data.current?.type as string

      // ── Column reorder ──
      if (activeType === "Column" && overType === "Column") {
        const fromIdx = columns.findIndex((c) => c.id === active.id)
        const toIdx = columns.findIndex((c) => c.id === over.id)
        if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
          const nextColumns = arrayMove(columns, fromIdx, toIdx)
          setColumns(nextColumns)
          persistBoard(nextColumns, taskOrder)
        }
        return
      }

      // ── Task reorder within or across columns ──
      if (activeType === "Task") {
        const activeTaskObj = active.data.current?.task as Task

        let toColId: string
        if (overType === "Column") {
          toColId = over.id as string
        } else if (overType === "Task") {
          const overTask = over.data.current?.task as Task
          toColId =
            Object.entries(taskOrder).find(([, ids]) =>
              ids.includes(overTask.id)
            )?.[0] ?? activeTaskObj.status
        } else {
          return
        }

        const fromColId =
          Object.entries(taskOrder).find(([, ids]) =>
            ids.includes(activeTaskObj.id)
          )?.[0] ?? activeTaskObj.status

        // If moving across columns, update the task's status in Firestore.
        if (fromColId !== toColId) {
          const statusMap: Record<string, TaskStatus> = {
            todo: "todo",
            "in-progress": "in-progress",
            done: "done",
          }
          const newStatus = statusMap[toColId] ?? "todo"
          updateTask(activeTaskObj.id, { status: newStatus })
          logActivity({
            type: "task_updated",
            task_id: activeTaskObj.id,
            task_title: activeTaskObj.title,
            detail: `Moved to "${columns.find((c) => c.id === toColId)?.title ?? toColId}"`,
          })
        }

        // Reorder within column if dropping on another task.
        if (overType === "Task" && fromColId === toColId) {
          const overTask = over.data.current?.task as Task
          const colIds = taskOrder[fromColId] ?? []
          const fromIdx = colIds.indexOf(activeTaskObj.id)
          const toIdx = colIds.indexOf(overTask.id)
          if (fromIdx !== -1 && toIdx !== -1 && fromIdx !== toIdx) {
            const nextIds = arrayMove(colIds, fromIdx, toIdx)
            const nextOrder = { ...taskOrder, [fromColId]: nextIds }
            setTaskOrder(nextOrder)
            persistBoard(columns, nextOrder)
            return
          }
        }

        persistBoard(columns, taskOrder)
      }
    },
    [columns, taskOrder, persistBoard, updateTask, logActivity]
  )

  // ── Delete confirmation dialog data ──────────────────────────────────────────

  const deleteTargetColumn = useMemo(
    () => columns.find((c) => c.id === deleteTarget) ?? null,
    [columns, deleteTarget]
  )

  const deleteTargetTaskCount = useMemo(
    () => (deleteTarget ? (taskOrder[deleteTarget]?.length ?? 0) : 0),
    [taskOrder, deleteTarget]
  )

  const hasOtherColumns = columns.length > 1

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex gap-4 p-4 overflow-x-auto">
        {[1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-3">
            <Skeleton className="h-8 w-32" />
            {[1, 2, 3].map((j) => (
              <Skeleton key={j} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 overflow-x-auto min-h-full items-start">
          <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                columns={columns}
                tasks={tasksByColumn[col.id] ?? []}
                headerSlot={
                  <SortableColumnHeader
                    column={col}
                    onRename={renameColumn}
                    onDelete={requestDeleteColumn}
                    disabled={columns.length <= 1}
                  />
                }
                onAddCard={(colId, title) => addCard(colId, title)}
                onDeleteCard={deleteCard}
                onUpdateCard={updateCard}
              />
            ))}
          </SortableContext>
        </div>

        {mounted && createPortal(
          <DragOverlay>
            {activeTask && (
              <KanbanCard
                task={activeTask}
                isDragOverlay
              />
            )}
          </DragOverlay>,
          document.body
        )}
      </DndContext>

      {/* Delete column confirmation dialog */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sütunu sil</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTargetTaskCount > 0 ? (
                hasOtherColumns ? (
                  <>
                    <strong>{deleteTargetColumn?.title}</strong> sütununda{" "}
                    {deleteTargetTaskCount} görev var. Bu görevler ilk sütuna
                    taşınacak.
                  </>
                ) : (
                  <>
                    Bu tek sütundur ve {deleteTargetTaskCount} görev içeriyor.
                    Silerek görevlerin sütun bilgisini kaldırmış olursunuz.
                  </>
                )
              ) : (
                <>
                  <strong>{deleteTargetColumn?.title}</strong> sütununu silmek
                  istediğinizden emin misiniz?
                </>
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