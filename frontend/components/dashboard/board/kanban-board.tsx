"use client"

import React, { useState, useMemo, useCallback } from "react"
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
import { arrayMove, SortableContext } from "@dnd-kit/sortable"
import { createPortal } from "react-dom"
import { KanbanColumn, Column } from "./kanban-column"
import { KanbanCard, Task } from "./kanban-card"
import { TaskStatus } from "@/types/task"
import { useTasks } from "@/contexts/task-context"
import { toast } from "sonner"

const defaultColumns: Column[] = [
  { id: "todo", title: "To-Do" },
  { id: "in-progress", title: "In Progress" },
  { id: "done", title: "Completed" },
]

interface KanbanBoardProps {
  onAddColumn?: (addColumnFn: (title: string) => void) => void
}

export function KanbanBoard({ onAddColumn }: KanbanBoardProps) {
  const id = React.useId()
  const { tasks, addTask, updateTask, deleteTask } = useTasks()
  const [columns, setColumns] = useState<Column[]>(defaultColumns)
  const columnsId = useMemo(() => columns.map((col) => col.id), [columns])
  const [activeTask, setActiveTask] = useState<Task | null>(null)
  // Local ordering state — tracks display order without touching the context
  const [orderedIds, setOrderedIds] = useState<string[]>([])

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

  const addCard = useCallback(
    (columnId: string, title: string) => {
      const newTask: Task = {
        id: `kb-${Date.now()}`,
        title,
        status: columnId as TaskStatus,
        priority: "medium",
        assignee: "",
        dueDate: "",
        tags: [],
        createdAt: new Date().toISOString().slice(0, 10),
      }
      addTask(newTask)
      toast.success("Card added")
    },
    [addTask]
  )

  const updateCard = useCallback(
    (taskId: string, updates: Partial<Pick<Task, "title" | "priority" | "tags">>) => {
      updateTask(taskId, updates)
      toast.success("Card updated")
    },
    [updateTask]
  )

  const deleteCard = useCallback(
    (taskId: string) => {
      deleteTask(taskId)
      toast.success("Card deleted")
    },
    [deleteTask]
  )

  const addColumn = useCallback((title: string) => {
    const trimmed = title.trim()
    if (!trimmed) return
    const newCol: Column = {
      id: `col-${Date.now()}` as Column["id"],
      title: trimmed,
    }
    setColumns((prev) => [...prev, newCol])
    toast.success(`Column "${trimmed}" added`)
  }, [])

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
      const activeTask = displayTasks[activeIndex]
      const overTask = displayTasks[overIndex]
      if (activeTask.status !== overTask.status) {
        updateTask(activeId, { status: overTask.status })
      }
      setOrderedIds(arrayMove(ids, activeIndex, overIndex))
      return
    }

    const isOverAColumn = over.data.current?.type === "Column"
    if (isActiveATask && isOverAColumn) {
      const activeTask = displayTasks.find((t) => t.id === activeId)
      if (activeTask && activeTask.status !== overId) {
        updateTask(activeId, { status: overId as TaskStatus })
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

    const isActiveATask = active.data.current?.type === "Task"
    const isOverAColumn = over.data.current?.type === "Column"
    if (isActiveATask && isOverAColumn) {
      const activeTask = displayTasks.find((t) => t.id === activeId)
      if (activeTask && activeTask.status !== overId) {
        updateTask(activeId, { status: overId as TaskStatus })
      }
    }
  }

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  }

  return (
    <DndContext
      id={id}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex h-full gap-6 overflow-x-auto px-1 pb-4">
        <SortableContext items={columnsId}>
          {columns.map((col) => (
            <KanbanColumn
              key={col.id}
              column={col}
              tasks={tasksByColumn[col.id] || []}
              onAddCard={addCard}
              onDeleteCard={deleteCard}
              onUpdateCard={updateCard}
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
  )
}