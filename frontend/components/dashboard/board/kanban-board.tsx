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
import { useTasks } from "@/contexts/task-context"
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

const defaultColumns: Column[] = [
  { id: "todo", title: "Yapılacak" },
  { id: "in-progress", title: "Devam Ediyor" },
  { id: "done", title: "Tamamlandı" },
]

interface KanbanBoardProps {
  onAddColumn?: (addColumnFn: (title: string) => void) => void
  storageKey?: string
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
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Sütunu Düzenle
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
    <div ref={setNodeRef} style={style} className={cn("flex-1 min-w-[260px] max-w-[500px]", isDragging && "z-10")}>
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

// ─── Main board ──────────────────────────────────────────────────────────────

export function KanbanBoard({ onAddColumn, storageKey }: KanbanBoardProps) {
  const id = React.useId()
  const globalCtx = useTasks()

  const [columns, setColumns] = useState<Column[]>(defaultColumns)
  const [localCards, setLocalCards] = useState<Task[]>([])
  const [hydrated, setHydrated] = useState(false)
  const columnsId = useMemo(() => columns.map((col) => col.id), [columns])
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [orderedIds, setOrderedIds] = useState<string[]>([])

  // Load per-project state from localStorage
  useEffect(() => {
    if (!storageKey) { setHydrated(true); return }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const saved = JSON.parse(raw)
        if (Array.isArray(saved.columns) && saved.columns.length > 0) setColumns(saved.columns)
        if (Array.isArray(saved.cards)) setLocalCards(saved.cards)
      }
    } catch { /* ignore */ }
    setHydrated(true)
  }, [storageKey])

  // Persist per-project state and notify same-tab listeners
  useEffect(() => {
    if (!storageKey || !hydrated) return
    localStorage.setItem(storageKey, JSON.stringify({ columns, cards: localCards }))
    window.dispatchEvent(new CustomEvent("wms:kanban-changed", { detail: { key: storageKey } }))
  }, [storageKey, columns, localCards, hydrated])

  const tasks = storageKey ? localCards : globalCtx.tasks

  const displayTasks = useMemo(() => {
    const contextIds = tasks.map((t) => t.id)
    const filtered = orderedIds.filter((id) => contextIds.includes(id))
    const newIds = contextIds.filter((id) => !filtered.includes(id))
    const merged = [...filtered, ...newIds]
    return merged.map((id) => tasks.find((t) => t.id === id)!).filter(Boolean)
  }, [tasks, orderedIds])

  const tasksByColumn = useMemo(() => {
    const groups: Record<string, Task[]> = {}
    columns.forEach((col) => {
      groups[col.id] = displayTasks.filter((t) => t.status === col.id)
    })
    return groups
  }, [displayTasks, columns])

  const _updateCard = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      if (storageKey) {
        setLocalCards((prev) => prev.map((c) => (c.id === taskId ? { ...c, ...updates } : c)))
      } else {
        globalCtx.updateTask(taskId, updates)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  )

  const _deleteCard = useCallback(
    (taskId: string) => {
      if (storageKey) {
        setLocalCards((prev) => prev.filter((c) => c.id !== taskId))
      } else {
        globalCtx.deleteTask(taskId)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  )

  const addCard = useCallback(
    (columnId: string, title: string) => {
      const newTask: Task = {
        id: `kb-${Date.now()}`,
        title,
        status: columnId as TaskStatus,
        priority: "medium",
        assignees: [],
        dueDate: "",
        tags: [],
        createdAt: new Date().toISOString().slice(0, 10),
      }
      if (storageKey) {
        setLocalCards((prev) => [...prev, newTask])
      } else {
        globalCtx.addTask(newTask)
      }
      toast.success("Kart eklendi")
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey]
  )

  const duplicateCard = useCallback(
    (taskId: string) => {
      const source = (storageKey ? localCards : globalCtx.tasks).find((t) => t.id === taskId)
      if (!source) return
      const copy: Task = { ...source, id: `kb-${Date.now()}`, title: `${source.title} (kopya)`, createdAt: new Date().toISOString().slice(0, 10) }
      if (storageKey) {
        setLocalCards((prev) => [...prev, copy])
      } else {
        globalCtx.addTask(copy)
      }
      toast.success("Kart kopyalandı")
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [storageKey, localCards]
  )

  const updateCard = useCallback(
    (taskId: string, updates: Partial<Task>) => {
      _updateCard(taskId, updates)
    },
    [_updateCard]
  )

  const deleteCard = useCallback(
    (taskId: string) => {
      _deleteCard(taskId)
      toast.success("Kart silindi")
    },
    [_deleteCard]
  )

  const addColumn = useCallback((title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const newCol: Column = {
      id: `col-${Date.now()}` as Column["id"],
      title: trimmed,
    }
    setColumns((prev) => [...prev, newCol])
    toast.success(`"${trimmed}" sütunu eklendi`)
  }, [])

  const renameColumn = useCallback((id: string, newTitle: string) => {
    setColumns((prev) => prev.map((c) => (c.id === id ? { ...c, title: newTitle } : c)))
    toast.success("Sütun adı güncellendi")
  }, [])

  const requestDeleteColumn = useCallback((id: string) => {
    setDeleteTarget(id)
  }, [])

  const confirmDeleteColumn = () => {
    if (!deleteTarget) return
    const remaining = columns.filter((c) => c.id !== deleteTarget)
    if (remaining.length > 0) {
      tasks
        .filter((t) => t.status === deleteTarget)
        .forEach((t) => _updateCard(t.id, { status: remaining[0].id as TaskStatus }))
    } else {
      tasks.filter((t) => t.status === deleteTarget).forEach((t) => _deleteCard(t.id))
    }
    setColumns(remaining)
    setDeleteTarget(null)
    toast.success("Sütun silindi")
  }

  React.useEffect(() => {
    onAddColumn?.(addColumn)
  }, [onAddColumn, addColumn])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  function onDragStart(event: DragStartEvent) {
    if (event.active.data.current?.type === "Task") {
      setActiveTask(event.active.data.current.task)
    }
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    const isActiveATask = active.data.current?.type === "Task"
    const isOverATask = over.data.current?.type === "Task"

    if (!isActiveATask) return

    if (isActiveATask && isOverATask) {
      const ids = displayTasks.map((t) => t.id)
      const activeIndex = ids.indexOf(activeId)
      const overIndex = ids.indexOf(overId)
      const aTask = displayTasks[activeIndex]
      const oTask = displayTasks[overIndex]
      if (aTask.status !== oTask.status) {
        _updateCard(activeId, { status: oTask.status })
      }
      setOrderedIds(arrayMove(ids, activeIndex, overIndex))
      return
    }

    const isOverAColumn = over.data.current?.type === "Column"
    if (isActiveATask && isOverAColumn) {
      const aTask = displayTasks.find((t) => t.id === activeId)
      if (aTask && aTask.status !== overId) {
        _updateCard(activeId, { status: overId as TaskStatus })
      }
    }
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveTask(null)
    if (!over) return
    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    // Column reorder
    if (active.data.current?.type === "Column" && columns.some((c) => c.id === overId)) {
      const oldIndex = columns.findIndex((c) => c.id === activeId)
      const newIndex = columns.findIndex((c) => c.id === overId)
      if (oldIndex !== newIndex) setColumns(arrayMove(columns, oldIndex, newIndex))
      return
    }

    // Task → column drop
    const isActiveATask = active.data.current?.type === "Task"
    const isOverAColumn = over.data.current?.type === "Column"
    if (isActiveATask && isOverAColumn) {
      const aTask = displayTasks.find((t) => t.id === activeId)
      if (aTask && aTask.status !== overId) {
        _updateCard(activeId, { status: overId as TaskStatus })
      }
    }
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  }

  const deleteTargetColumn = columns.find((c) => c.id === deleteTarget)
  const deleteTargetTaskCount = deleteTarget
    ? (tasksByColumn[deleteTarget] ?? []).length
    : 0
  const hasOtherColumns = columns.length > 1

  return (
    <>
      <DndContext
        id={id}
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex h-full w-full gap-4 overflow-x-auto px-4 pb-4 pt-1">
          <SortableContext items={columnsId} strategy={horizontalListSortingStrategy}>
            {columns.map((col) => (
              <SortableColumnWrapper
                key={col.id}
                column={col}
                columns={columns}
                tasks={tasksByColumn[col.id] || []}
                onAddCard={addCard}
                onDeleteCard={deleteCard}
                onUpdateCard={updateCard}
                onDuplicateCard={duplicateCard}
                onRename={renameColumn}
                onDelete={requestDeleteColumn}
              />
            ))}
          </SortableContext>
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