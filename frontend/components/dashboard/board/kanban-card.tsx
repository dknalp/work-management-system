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
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
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
  PencilIcon,
  Trash2Icon,
  CalendarIcon,
  UserIcon,
  ChevronDownIcon,
  CopyIcon,
  ArrowRightIcon,
  FlagIcon,
} from "lucide-react"
import { Task } from "@/types/task"
import { usePermission } from "@/hooks/use-permission"
import { useTeam } from "@/contexts/team-context"
import { Column } from "./kanban-column"

export type { Task }

interface KanbanCardProps {
  task: Task
  isOverlay?: boolean
  columns?: Column[]
  onDelete?: (taskId: string) => void
  onUpdate?: (taskId: string, updates: Partial<Task>) => void
  onDuplicate?: (taskId: string) => void
}

const priorityColors = {
  low: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  medium: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  high: "bg-rose-500/10 text-rose-500 border-rose-500/20",
}

const priorityLabels = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
}

export function KanbanCard({
  task,
  isOverlay,
  columns,
  onDelete,
  onUpdate,
  onDuplicate,
}: KanbanCardProps) {
  const canEdit = usePermission("board:edit")
  const { members } = useTeam()
  const [detailOpen, setDetailOpen] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDescription, setEditDescription] = useState(task.description ?? "")
  const [editPriority, setEditPriority] = useState<Task["priority"]>(task.priority)
  const [editTagsInput, setEditTagsInput] = useState((task.tags ?? []).join(", "))
  const [editAssignees, setEditAssignees] = useState<string[]>(task.assignees ?? [])
  const [editDueDate, setEditDueDate] = useState(task.due_date ?? "")
  const [assigneeOpen, setAssigneeOpen] = useState(false)

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
    setEditDescription(task.description ?? "")
    setEditPriority(task.priority)
    setEditTagsInput((task.tags ?? []).join(", "))
    setEditAssignees(task.assignees ?? [])
    setEditDueDate(task.due_date ?? "")
    setDetailOpen(true)
  }

  function handleSave() {
    const tags = editTagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean)
    onUpdate?.(task.id, {
      title: editTitle,
      priority: editPriority,
      tags,
      description: editDescription,
      assignees: editAssignees,
      due_date: editDueDate,
    })
    setDetailOpen(false)
  }

  function toggleAssignee(name: string) {
    setEditAssignees((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    )
  }

  function handleDelete() {
    setDetailOpen(false)
    onDelete?.(task.id)
  }

  const assignees = task.assignees ?? []
  const firstAssignee = assignees[0] ?? null
  const assigneeInitials = firstAssignee ? getInitials(firstAssignee) : null

  const dueDateDisplay = task.due_date
    ? new Date(task.due_date).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
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
            onClick={openDetail}
          >
            <CardContent className="space-y-2.5 p-4 font-sans">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant="outline"
                  className={cn(
                    "h-5 px-1.5 text-[10px] font-bold tracking-wider uppercase",
                    priorityColors[task.priority]
                  )}
                >
                  {priorityLabels[task.priority]}
                </Badge>
                {dueDateDisplay && (
                  <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <CalendarIcon className="size-2.5" />
                    {dueDateDisplay}
                  </span>
                )}
              </div>

              <p className="text-sm leading-tight font-medium text-foreground/90">
                {task.title}
              </p>

              {(task.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {(task.tags ?? []).map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="h-4 bg-muted/50 px-1.5 text-[10px] font-normal text-muted-foreground"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {assignees.length > 0 && (
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-[10px] text-muted-foreground truncate max-w-[55%]">
                    {assignees.length === 1
                      ? firstAssignee!.split(" ")[0]
                      : `${firstAssignee!.split(" ")[0]} +${assignees.length - 1}`}
                  </span>
                  <div className="flex -space-x-1.5">
                    {assignees.slice(0, 3).map((name) => (
                      <Avatar key={name} className="size-6 border-2 border-background shrink-0">
                        <AvatarFallback className="text-[7px]">{getInitials(name)}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {canEdit && columns && columns.filter((c) => c.id !== task.status).length > 0 && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <ArrowRightIcon className="size-3.5" />
                Taşı
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-44">
                {columns
                  .filter((c) => c.id !== task.status)
                  .map((col) => (
                    <ContextMenuItem
                      key={col.id}
                      onSelect={() => onUpdate?.(task.id, { status: col.id as Task["status"] })}
                    >
                      {col.title}
                    </ContextMenuItem>
                  ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          {canEdit && (
            <ContextMenuSub>
              <ContextMenuSubTrigger className="gap-2">
                <FlagIcon className="size-3.5" />
                Öncelik
              </ContextMenuSubTrigger>
              <ContextMenuSubContent className="w-36">
                {(["low", "medium", "high"] as const).map((p) => (
                  <ContextMenuItem
                    key={p}
                    className={task.priority === p ? "font-semibold" : ""}
                    onSelect={() => onUpdate?.(task.id, { priority: p })}
                  >
                    {priorityLabels[p]}
                    {task.priority === p && <span className="ml-auto text-xs">✓</span>}
                  </ContextMenuItem>
                ))}
              </ContextMenuSubContent>
            </ContextMenuSub>
          )}

          <ContextMenuSeparator />

          {canEdit && (
            <ContextMenuItem className="gap-2" onSelect={openDetail}>
              <PencilIcon className="size-3.5" />
              Görevi Düzenle
            </ContextMenuItem>
          )}

          {canEdit && (
            <ContextMenuItem className="gap-2" onSelect={() => onDuplicate?.(task.id)}>
              <CopyIcon className="size-3.5" />
              Çoğalt
            </ContextMenuItem>
          )}

          <ContextMenuSeparator />

          {canEdit && (
            <ContextMenuItem
              variant="destructive"
              className="gap-2"
              onSelect={() => onDelete?.(task.id)}
            >
              <Trash2Icon className="size-3.5" />
              Görevi Sil
            </ContextMenuItem>
          )}
        </ContextMenuContent>
      </ContextMenu>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Görev Detayı
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label
                htmlFor="card-title"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Başlık
              </Label>
              <Textarea
                id="card-title"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                rows={2}
                className="resize-none text-sm"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="card-desc"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Açıklama
              </Label>
              <Textarea
                id="card-desc"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={3}
                placeholder="Görev hakkında notlar…"
                className="resize-none text-sm"
                disabled={!canEdit}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Öncelik
              </Label>
              <div className="flex gap-2">
                {(["low", "medium", "high"] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setEditPriority(p)}
                    className={cn(
                      "flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold tracking-wider uppercase transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                      editPriority === p
                        ? priorityColors[p] + " ring-2 ring-current ring-offset-1"
                        : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {priorityLabels[p]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  Atanan Kişiler
                </Label>
                <div className="relative">
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() => setAssigneeOpen((v) => !v)}
                    className={cn(
                      "flex min-h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1.5 text-sm shadow-sm transition-colors",
                      "hover:bg-muted focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    <span className="flex flex-wrap items-center gap-1 min-w-0 flex-1">
                      {editAssignees.length > 0 ? (
                        editAssignees.map((name) => (
                          <span key={name} className="flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                            <Avatar className="size-3.5 shrink-0">
                              <AvatarFallback className="text-[7px]">{getInitials(name)}</AvatarFallback>
                            </Avatar>
                            {name.split(" ")[0]}
                          </span>
                        ))
                      ) : (
                        <>
                          <UserIcon className="size-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-sm">Seç…</span>
                        </>
                      )}
                    </span>
                    <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0 ml-1" />
                  </button>
                  {assigneeOpen && (
                    <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-popover shadow-md overflow-hidden max-h-52 overflow-y-auto">
                      {members.map((member) => {
                        const selected = editAssignees.includes(member.name)
                        return (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => toggleAssignee(member.name)}
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors",
                              selected && "bg-primary/5 text-primary"
                            )}
                          >
                            <Avatar className="size-5 shrink-0">
                              <AvatarFallback className="text-[8px]">{getInitials(member.name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate flex-1">{member.name}</span>
                            {selected && <span className="text-xs text-primary shrink-0">✓</span>}
                          </button>
                        )
                      })}
                      {editAssignees.length > 0 && (
                        <button
                          type="button"
                          onClick={() => { setEditAssignees([]); setAssigneeOpen(false) }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:bg-muted border-t border-border transition-colors"
                        >
                          <UserIcon className="size-3.5" />
                          Tümünü kaldır
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor="card-due"
                  className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
                >
                  Bitiş Tarihi
                </Label>
                <input
                  id="card-due"
                  type="date"
                  value={editDueDate}
                  onChange={(e) => setEditDueDate(e.target.value)}
                  disabled={!canEdit}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="card-tags"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Etiketler{" "}
                <span className="normal-case font-normal text-muted-foreground/70">
                  (virgülle ayırın)
                </span>
              </Label>
              <input
                id="card-tags"
                type="text"
                value={editTagsInput}
                onChange={(e) => setEditTagsInput(e.target.value)}
                placeholder="Tasarım, API, İnceleme"
                disabled={!canEdit}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
            {canEdit ? (
              <Button
                variant="destructive"
                size="sm"
                className="gap-1.5"
                onClick={handleDelete}
              >
                <Trash2Icon className="size-3.5" />
                Sil
              </Button>
            ) : <span />}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDetailOpen(false)}
              >
                İptal
              </Button>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!editTitle.trim()}
                >
                  Kaydet
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
