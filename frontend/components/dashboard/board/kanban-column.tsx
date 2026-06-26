"use client"

import React, { useMemo, useState, useRef, useEffect } from "react"
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { KanbanCard, Task } from "./kanban-card"
import { Button } from "@/components/ui/button"
import { MoreHorizontalIcon, PlusIcon, XIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export type ColumnId = string

export type Column = {
  id: ColumnId
  title: string
}

interface KanbanColumnProps {
  column: Column
  tasks: Task[]
  onAddCard: (columnId: string, title: string) => void
  onDeleteCard: (taskId: string) => void
  onUpdateCard: (
    taskId: string,
    updates: Partial<Pick<Task, "title" | "priority" | "tags">>
  ) => void
}

export function KanbanColumn({
  column,
  tasks,
  onAddCard,
  onDeleteCard,
  onUpdateCard,
}: KanbanColumnProps) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks])
  const [isAddingCard, setIsAddingCard] = useState(false)
  const [newCardTitle, setNewCardTitle] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { setNodeRef } = useSortable({
    id: column.id,
    data: useMemo(
      () => ({
        type: "Column",
        column,
      }),
      [column]
    ),
  })

  useEffect(() => {
    if (isAddingCard) {
      inputRef.current?.focus()
    }
  }, [isAddingCard])

  function startAddingCard() {
    setNewCardTitle("")
    setIsAddingCard(true)
  }

  function cancelAddingCard() {
    setIsAddingCard(false)
    setNewCardTitle("")
  }

  function commitAddCard() {
    const trimmed = newCardTitle.trim()
    if (!trimmed) {
      cancelAddingCard()
      return
    }
    onAddCard(column.id, trimmed)
    setNewCardTitle("")
    setIsAddingCard(false)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      commitAddCard()
    }
    if (e.key === "Escape") {
      cancelAddingCard()
    }
  }

  return (
    <div
      ref={setNodeRef}
      className="flex h-full max-h-full w-full min-w-[300px] flex-col rounded-2xl border border-border/50 bg-muted/30 p-4"
    >
      {/* Header */}
      <div className="group/header mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="size-2 rounded-full bg-primary/40 transition-colors group-hover/header:bg-primary" />
          <h3 className="text-sm font-semibold tracking-tight">
            {column.title}
          </h3>
          <span className="flex size-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground tabular-nums">
            {tasks.length}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/header:opacity-100">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={startAddingCard}
          >
            <PlusIcon className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <MoreHorizontalIcon className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent flex min-h-[200px] flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              onDelete={onDeleteCard}
              onUpdate={onUpdateCard}
            />
          ))}
          {tasks.length === 0 && !isAddingCard && (
            <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/50 py-12 opacity-50">
              <p className="text-xs text-muted-foreground italic">
                Burada görev yok
              </p>
            </div>
          )}
        </SortableContext>

        {/* Inline add card input */}
        {isAddingCard && (
          <div className="space-y-2 rounded-xl border border-primary/30 bg-background p-3 shadow-sm">
            <textarea
              ref={inputRef}
              value={newCardTitle}
              onChange={(e) => setNewCardTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Kart başlığı… (Kaydetmek için Enter, iptal için Esc)"
              rows={2}
              className={cn(
                "w-full resize-none rounded-md bg-transparent text-sm text-foreground placeholder:text-muted-foreground",
                "focus:outline-none"
              )}
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={commitAddCard}
                disabled={!newCardTitle.trim()}
              >
                Kart ekle
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={cancelAddingCard}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Footer add button */}
      {!isAddingCard && (
        <Button
          variant="ghost"
          className="mt-3 h-9 w-full justify-start gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          onClick={startAddingCard}
        >
          <PlusIcon className="size-3.5" />
          Kart Ekle
        </Button>
      )}
    </div>
  )
}
