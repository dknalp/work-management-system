"use client"

import { useState, useEffect } from "react"
import { X, Pencil } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Task,
  SubTask,
  TaskStatus,
  TaskPriority,
  TASK_STATUSES,
  TASK_PRIORITIES,
  Comment,
} from "@/types/task"
import { SubtasksModal } from "./subtasks-modal"
import { CommentsModal } from "./comments-modal"
import { formatDistanceToNow } from "date-fns"
import { useAuth } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import { useTeam } from "@/contexts/team-context"

interface TaskDetailModalProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onTaskChange: (updated: Task) => void
}

const STATUS_COLORS: Record<string, string> = {
  "todo": "bg-muted text-muted-foreground",
  "in-progress": "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "done": "bg-green-500/15 text-green-600 dark:text-green-400",
}

const PRIORITY_COLORS: Record<string, string> = {
  "low": "bg-muted text-muted-foreground",
  "medium": "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400",
  "high": "bg-orange-500/15 text-orange-600 dark:text-orange-400",
}

export function TaskDetailModal({
  task,
  open,
  onOpenChange,
  onTaskChange,
}: TaskDetailModalProps) {
  const { user } = useAuth()
  const canAssign = usePermission("tasks:assign")
  const { members } = useTeam()
  const [newSubTaskTitle, setNewSubTaskTitle] = useState("")
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Task>>({})
  const [tagInput, setTagInput] = useState("")
  const [showAllSubTasks, setShowAllSubTasks] = useState(false)
  const [showAllComments, setShowAllComments] = useState(false)
  const [commentInput, setCommentInput] = useState("")
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyInput, setReplyInput] = useState("")

  useEffect(() => {
    setIsEditing(false)
    setDraft({})
  }, [task])

  function handleStartEdit() {
    if (!task) return
    setDraft({
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignees: [...(task.assignees ?? [])],
      due_date: task.due_date,
      description: task.description ?? "",
      tags: [...(task.tags ?? [])],
    })
    setIsEditing(true)
  }

  function handleSave() {
    if (!task) return
    onTaskChange({ ...task, ...draft } as Task)
    setIsEditing(false)
  }

  function handleCancel() {
    setDraft({})
    setIsEditing(false)
  }

  function handleAddTag() {
    const trimmed = tagInput.trim()
    if (!trimmed) return
    if ((draft.tags ?? []).includes(trimmed)) {
      setTagInput("")
      return
    }
    setDraft((d) => ({ ...d, tags: [...(d.tags ?? []), trimmed] }))
    setTagInput("")
  }

  function handleRemoveTag(tag: string) {
    setDraft((d) => ({ ...d, tags: (d.tags ?? []).filter((t) => t !== tag) }))
  }

  function handleToggleSubTask(id: string) {
    if (!task) return
    const updated: Task = {
      ...task,
      sub_tasks: (task.sub_tasks ?? []).map((st) =>
        st.id === id ? { ...st, completed: !st.completed } : st
      ),
    }
    onTaskChange(updated)
  }

  function handleDeleteSubTask(id: string) {
    if (!task) return
    const updated: Task = {
      ...task,
      sub_tasks: (task.sub_tasks ?? []).filter((st) => st.id !== id),
    }
    onTaskChange(updated)
  }

  function handleAddSubTask() {
    const title = newSubTaskTitle.trim()
    if (!task || !title) return
    const newSub: SubTask = {
      id: crypto.randomUUID(),
      title,
      completed: false,
    }
    const updated: Task = {
      ...task,
      sub_tasks: [...(task.sub_tasks ?? []), newSub],
    }
    onTaskChange(updated)
    setNewSubTaskTitle("")
  }

  const submitComment = () => {
    if (!commentInput.trim() || !task) return
    onTaskChange({
      ...task,
      comments: [
        ...(task.comments ?? []),
        {
          id: crypto.randomUUID(),
          author_id: user?.id ?? "",
          author_name: user?.name ?? "You",
          body: commentInput.trim(),
          created_at: new Date().toISOString(),
          replies: [],
        },
      ],
    })
    setCommentInput("")
  }

  const submitReply = (commentId: string) => {
    if (!replyInput.trim() || !task) return
    const updated = (task.comments ?? []).map((c) =>
      c.id === commentId
        ? {
            ...c,
            replies: [
              ...(c.replies ?? []),
              {
                id: crypto.randomUUID(),
                author_id: user?.id ?? "",
                author_name: user?.name ?? "You",
                body: replyInput.trim(),
                created_at: new Date().toISOString(),
              },
            ],
          }
        : c
    )
    onTaskChange({ ...task, comments: updated })
    setReplyInput("")
    setReplyingTo(null)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {task && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-2 w-full">
                  {isEditing ? (
                    <Input
                      value={draft.title ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, title: e.target.value }))
                      }
                      className="text-base font-semibold flex-1"
                      aria-label="Task title"
                    />
                  ) : (
                    <>
                      <DialogTitle className="text-xl font-semibold leading-tight pr-2">
                        {task.title}
                      </DialogTitle>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleStartEdit}
                        className="shrink-0"
                      >
                        <Pencil size={14} className="mr-1" />
                        Düzenle
                      </Button>
                    </>
                  )}
                </div>
              </DialogHeader>

              {isEditing ? (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Durum</p>
                      <Select
                        value={draft.status}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, status: v as TaskStatus }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value}>
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground mb-1">Öncelik</p>
                      <Select
                        value={draft.priority}
                        onValueChange={(v) =>
                          setDraft((d) => ({ ...d, priority: v as TaskPriority }))
                        }
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_PRIORITIES.map((p) => (
                            <SelectItem key={p.value} value={p.value}>
                              {p.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Sorumlular</p>
                      {canAssign ? (
                        <div className="flex flex-col gap-1 max-h-36 overflow-y-auto rounded-md border border-input p-1">
                          {members.map((member) => {
                            const checked = (draft.assignees ?? []).includes(member.name)
                            return (
                              <label
                                key={member.id}
                                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm"
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setDraft((d) => {
                                      const curr = d.assignees ?? []
                                      return {
                                        ...d,
                                        assignees: checked
                                          ? curr.filter((a) => a !== member.name)
                                          : [...curr, member.name],
                                      }
                                    })
                                  }
                                  className="accent-primary"
                                />
                                {member.name}
                              </label>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="h-8 flex items-center text-sm text-muted-foreground">
                          {(draft.assignees ?? []).join(", ") || "—"}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Son tarih</p>
                      <Input
                        type="date"
                        value={draft.due_date ?? ""}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, due_date: e.target.value }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Açıklama</p>
                    <Textarea
                      rows={3}
                      value={draft.description ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, description: e.target.value }))
                      }
                      className="text-sm resize-none"
                    />
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Etiketler</p>
                    {(draft.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(draft.tags ?? []).map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 text-xs bg-secondary text-secondary-foreground rounded-md px-2 py-0.5"
                          >
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Remove tag ${tag}`}
                            >
                              <X size={10} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                        placeholder="Etiket ekle…"
                        className="h-8 text-sm"
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={handleAddTag}
                        disabled={!tagInput.trim()}
                        className="h-8 shrink-0"
                      >
                        Ekle
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      variant="outline"
                      className={`capitalize border-transparent ${STATUS_COLORS[task.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {task.status}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`capitalize border-transparent ${PRIORITY_COLORS[task.priority] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {task.priority}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Sorumlular</span>
                    <span className="text-foreground">
                      {(task.assignees ?? []).length > 0 ? (task.assignees ?? []).join(", ") : "—"}
                    </span>
                    <span className="text-muted-foreground">Son tarih</span>
                    <span className="text-foreground">{task.due_date}</span>
                  </div>

                  {(task.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(task.tags ?? []).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">
                      Açıklama
                    </p>
                    {task.description ? (
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {task.description}
                      </p>
                    ) : (
                      <button
                        onClick={handleStartEdit}
                        className="text-sm text-muted-foreground/60 hover:text-muted-foreground italic"
                      >
                        Açıklama ekle...
                      </button>
                    )}
                  </div>
                </>
              )}

              <hr className="border-border" />

              <div>
                <p className="text-sm font-medium text-muted-foreground mb-2">
                  Alt görevler
                  {task.sub_tasks && task.sub_tasks.length > 0 && (
                    <span className="ml-1 text-xs font-normal">
                      ({task.sub_tasks.filter((s) => s.completed).length}/
                      {task.sub_tasks.length})
                    </span>
                  )}
                </p>

                {task.sub_tasks && task.sub_tasks.length > 0 && (
                  <ul className="space-y-1.5 mb-3">
                    {(showAllSubTasks ? task.sub_tasks : task.sub_tasks.slice(0, 3)).map((st) => (
                      <li key={st.id} className="flex items-center gap-2 group">
                        <Checkbox
                          id={`st-${st.id}`}
                          checked={st.completed}
                          onCheckedChange={() => handleToggleSubTask(st.id)}
                          className="shrink-0"
                        />
                        <label
                          htmlFor={`st-${st.id}`}
                          className={`flex-1 text-sm cursor-pointer select-none ${
                            st.completed
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {st.title}
                        </label>
                        <button
                          onClick={() => handleDeleteSubTask(st.id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                          aria-label="Delete sub-task"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {(task?.sub_tasks ?? []).length > 3 && !showAllSubTasks && (
                  <button
                    onClick={() => setShowAllSubTasks(true)}
                    className="mt-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Tümünü göster ({task.sub_tasks!.length}) alt görev →
                  </button>
                )}

                <div className="flex gap-2">
                  <Input
                    value={newSubTaskTitle}
                    onChange={(e) => setNewSubTaskTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddSubTask()}
                    placeholder="Yeni alt görev…"
                    className="h-8 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleAddSubTask}
                    disabled={!newSubTaskTitle.trim()}
                    className="h-8 shrink-0"
                  >
                    Add
                  </Button>
                </div>
              </div>

              <hr className="border-border my-3" />

              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  Yorumlar{(task?.comments ?? []).length > 0 && ` (${(task?.comments ?? []).length})`}
                </p>

                {(task?.comments ?? []).length > 0 && (
                  <div className="space-y-3 mb-2">
                    {(task?.comments ?? []).slice(0, 3).map((comment) => {
                      const initials = comment.author_name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .toUpperCase()
                        .slice(0, 2)
                      return (
                        <div key={comment.id}>
                          <div className="flex items-start gap-2">
                            <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                              {initials}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2">
                                <span className="text-sm font-medium">{comment.author_name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                </span>
                              </div>
                              <p className="text-sm mt-0.5">{comment.body}</p>
                              <button
                                onClick={() =>
                                  setReplyingTo(replyingTo === comment.id ? null : comment.id)
                                }
                                className="text-xs text-muted-foreground hover:text-foreground mt-1"
                              >
                                Yanıtla
                              </button>

                              {replyingTo === comment.id && (
                                <div className="flex gap-2 mt-2">
                                  <Input
                                    value={replyInput}
                                    onChange={(e) => setReplyInput(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault()
                                        submitReply(comment.id)
                                      }
                                    }}
                                    placeholder="Yanıt yaz…"
                                    className="h-7 text-sm flex-1"
                                  />
                                  <Button
                                    size="sm"
                                    className="h-7 shrink-0"
                                    onClick={() => submitReply(comment.id)}
                                  >
                                    Yanıtla
                                  </Button>
                                </div>
                              )}

                              {(comment.replies ?? []).length > 0 && (
                                <div className="mt-2 pl-3 border-l border-border space-y-2">
                                  {(comment.replies ?? []).map((reply) => {
                                    const replyInitials = reply.author_name
                                      .split(" ")
                                      .map((w) => w[0])
                                      .join("")
                                      .toUpperCase()
                                      .slice(0, 2)
                                    return (
                                      <div key={reply.id} className="flex items-start gap-2">
                                        <div className="size-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-semibold text-primary shrink-0">
                                          {replyInitials}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-baseline gap-2">
                                            <span className="text-xs font-medium">{reply.author_name}</span>
                                            <span className="text-xs text-muted-foreground">
                                              {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                                            </span>
                                          </div>
                                          <p className="text-xs mt-0.5">{reply.body}</p>
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {(task?.comments ?? []).length > 3 && (
                  <button
                    onClick={() => setShowAllComments(true)}
                    className="mb-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    Tümünü göster ({(task?.comments ?? []).length}) yorum →
                  </button>
                )}

                <div className="flex gap-2 mt-2">
                  <Input
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        submitComment()
                      }
                    }}
                    placeholder="Yorum ekle…"
                    className="flex-1"
                  />
                  <Button onClick={submitComment}>Ekle</Button>
                </div>
              </div>

              {isEditing && (
                <div className="flex justify-end gap-2 pt-3 border-t border-border mt-2">
                  <Button variant="ghost" onClick={handleCancel}>
                    İptal
                  </Button>
                  <Button onClick={handleSave}>Değişiklikleri kaydet</Button>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <SubtasksModal
        open={showAllSubTasks}
        onOpenChange={setShowAllSubTasks}
        taskTitle={task?.title ?? ""}
        subTasks={task?.sub_tasks ?? []}
        onSubTasksChange={(updated) => {
          if (task) onTaskChange({ ...task, sub_tasks: updated })
        }}
      />
      <CommentsModal
        open={showAllComments}
        onOpenChange={setShowAllComments}
        taskTitle={task?.title ?? ""}
        comments={task?.comments ?? []}
        onCommentsChange={(updated) => {
          if (task) onTaskChange({ ...task, comments: updated })
        }}
      />
    </>
  )
}