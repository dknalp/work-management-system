"use client"

import React, { useMemo, useState } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  MessageSquareIcon,
  PaperclipIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import { Task } from "@/components/tasks/task-types"

export type { Task }

interface KanbanCardProps {
  task: Task
  isOverlay?: boolean
  onDelete?: (taskId: string) => void
  onUpdate?: (
    taskId: string,
    updates: Partial<Pick<Task, "title" | "priority" | "tags">>
  ) => void
}

const priorityColors = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  high: "bg-rose-500/10 text-rose-500 border-rose-500/20",
}

export function KanbanCard({
  task,
  isOverlay,
  onDelete,
  onUpdate,
}: KanbanCardProps) {
  const [detailOpen, setDetailOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editPriority, setEditPriority] = useState<Task["priority"]>(
    task.priority
  )
  const [editTagsInput, setEditTagsInput] = useState(task.tags.join(", "))

  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: useMemo(
      () => ({
        type: "Task",
        task,
      }),
      [task]
    ),
    disabled: isOverlay,
  })

  const style = {
    transition,
    transform: CSS.Translate.toString(transform),
  }

  function openDetail() {
    setEditTitle(task.title)
    setEditPriority(task.priority)
    setEditTagsInput(task.tags.join(", "))
    setDetailOpen(true)
  }

  function handleSave() {
    const tags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    onUpdate?.(task.id, { title: editTitle, priority: editPriority, tags })
    setDetailOpen(false)
  }

  function handleDelete() {
    setDetailOpen(false)
    onDelete?.(task.id)
  }

  const assigneeInitials = task.assignee
    ? task.assignee
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="relative h-[120px] min-h-[120px] rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 opacity-50"
      />
    )
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <Card
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
              "group relative cursor-grab border-border transition-all hover:border-primary/30 hover:shadow-md active:cursor-grabbing",
              isOverlay &&
                "z-50 scale-105 rotate-1 cursor-grabbing border-primary shadow-xl"
            )}
            onDoubleClick={(e) => {
              e.stopPropagation()
              openDetail()
            }}
          >
            <CardContent className="space-y-3 p-4 font-sans">
              <div className="flex items-start justify-between gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-1.5 text-[10px] font-bold tracking-wider uppercase",
                    priorityColors[task.priority]
                  )}
                >
                  {task.priority}
                </Badge>
              </div>

              <p className="text-sm leading-tight font-medium text-foreground/90">
                {task.title}
              </p>

              <div className="flex flex-wrap gap-1">
                {task.tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="h-4 bg-muted/50 px-1.5 text-[10px] font-normal text-muted-foreground"
                  >
                    {tag}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <MessageSquareIcon className="size-3" />
                    <span className="text-[10px]">2</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <PaperclipIcon className="size-3" />
                    <span className="text-[10px]">1</span>
                  </div>
                </div>
                {assigneeInitials && (
                  <Avatar className="size-6 border-2 border-background">
                    <AvatarFallback className="text-[8px]">
                      {assigneeInitials}
                    </AvatarFallback>
                  </Avatar>
                )}
              </div>
            </CardContent>
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-40">
          <ContextMenuItem className="gap-2" onSelect={openDetail}>
            <PencilIcon className="size-3.5" />
            Edit Task
          </ContextMenuItem>
          <ContextMenuItem
            variant="destructive"
            className="gap-2"
            onSelect={() => onDelete?.(task.id)}
          >
            <Trash2Icon className="size-3.5" />
            Delete Task
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Task Detail
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label
                htmlFor="card-title"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Title
              </Label>
              <Textarea
                id="card-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Priority
              </Label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setEditPriority(p)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all",
                      editPriority === p
                        ? priorityColors[p] +
                            " ring-2 ring-current ring-offset-1"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="card-tags"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Tags{" "}
                <span className="font-normal normal-case">
                  (comma separated)
                </span>
              </Label>
              <input
                id="card-tags"
                type="text"
                value={editTagsInput}
                onChange={(e) => setEditTagsInput(e.target.value)}
                placeholder="Design, API, Review"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              onClick={handleDelete}
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!editTitle.trim()}
              >
                Save changes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}