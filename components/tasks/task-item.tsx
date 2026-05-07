"use client"

import { useMemo } from "react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  CalendarIcon,
  HashIcon,
  Trash2Icon,
  PencilIcon,
  GripVerticalIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format, isPast, isToday } from "date-fns"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"

export type Task = {
  id: string
  title: string
  description?: string
  completed: boolean
  tags: string[]
  dueDate: string
  createdAt: string
}

interface TaskItemProps {
  task: Task
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (task: Task) => void
}

export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
  const isOverdue =
    isPast(new Date(task.dueDate)) &&
    !isToday(new Date(task.dueDate)) &&
    !task.completed

  const {
    attributes,
    listeners,
    setNodeRef,
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
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  }

  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="mb-3 h-[100px] rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 opacity-50"
      />
    )
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className="mb-3 cursor-grab outline-none active:cursor-grabbing"
        >
          <Card
            className={cn(
              "border-border/50 bg-background/50 transition-all duration-300 hover:shadow-lg",
              task.completed && "opacity-60 grayscale-[0.5]"
            )}
          >
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Checkbox
                  checked={task.completed}
                  onCheckedChange={() => onToggle(task.id)}
                  className="mt-1 size-5 rounded-full"
                  onPointerDown={(e) => e.stopPropagation()} // Prevent drag when clicking checkbox
                />

                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="cursor-default">
                      <h3
                        className={cn(
                          "text-base leading-tight font-semibold transition-all",
                          task.completed && "text-muted-foreground line-through"
                        )}
                      >
                        {task.title}
                      </h3>
                      {task.description && (
                        <p
                          className={cn(
                            "mt-1 line-clamp-2 text-sm text-muted-foreground",
                            task.completed && "text-muted-foreground/50"
                          )}
                        >
                          {task.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                      <CalendarIcon
                        className={cn(
                          "size-3",
                          isOverdue ? "text-rose-500" : "text-primary/60"
                        )}
                      />
                      <span
                        className={cn(isOverdue && "font-bold text-rose-500")}
                      >
                        {format(new Date(task.dueDate), "MMM d, yyyy")}
                      </span>
                    </div>

                    {task.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {task.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="h-5 border-primary/10 bg-primary/5 px-2 text-[10px] text-primary transition-colors hover:bg-primary/10"
                          >
                            <HashIcon className="mr-1 size-2 opacity-60" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40">
        <ContextMenuItem className="gap-2" onClick={() => onEdit(task)}>
          <PencilIcon className="size-3.5" />
          Edit Todo
        </ContextMenuItem>
        <ContextMenuItem
          variant="destructive"
          className="gap-2"
          onClick={() => onDelete(task.id)}
        >
          <Trash2Icon className="size-3.5" />
          Delete Todo
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
