"use client"

import { useState, useEffect } from "react"
import { XIcon, TagIcon, CalendarIcon, SaveIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Task,
  TaskStatus,
  TaskPriority,
  TASK_STATUSES,
  TASK_PRIORITIES,
} from "@/types/task"
import { usePermission } from "@/hooks/use-permission"
import { useTeam } from "@/contexts/team-context"

interface EditTaskDialogProps {
  task: Task | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (updatedTask: Task) => void
}

export function EditTaskDialog({
  task,
  open,
  onOpenChange,
  onSave,
}: EditTaskDialogProps) {
  const canAssign = usePermission("tasks:assign")
  const { members } = useTeam()
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [assignees, setAssignees] = useState<string[]>([])
  const [dueDate, setDueDate] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string }>({})

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setStatus(task.status)
      setPriority(task.priority)
      setAssignees(task.assignees ?? [])
      setDueDate(task.due_date ?? "")
      setTags(task.tags ?? [])
      setErrors({})
    }
  }, [task])

  const validate = () => {
    const e: typeof errors = {}
    if (!title.trim()) e.title = "Başlık zorunludur"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSave = () => {
    if (!task || !validate()) return
    onSave({
      ...task,
      title: title.trim(),
      status,
      priority,
      assignees,
      due_date: dueDate,
      tags,
    })
    onOpenChange(false)
  }

  function toggleAssignee(name: string) {
    setAssignees((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    )
  }

  const addTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, "")
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput("")
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Görevi Düzenle</SheetTitle>
          <SheetDescription>
            Görev detaylarını aşağıdan güncelleyin ve değişikliklerinizi kaydedin.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-6 pr-1">
          {/* ID (read-only) */}
          {task && (
            <div className="flex items-center gap-2 rounded-md border border-border/40 bg-muted/30 px-3 py-2 font-mono text-xs text-muted-foreground">
              <span className="text-muted-foreground/60">Görev ID:</span>
              <span className="font-semibold text-foreground/70">
                {task.id}
              </span>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label
              htmlFor="edit-title"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Başlık <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="edit-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value)
                setErrors((p) => ({ ...p, title: undefined }))
              }}
              className={
                errors.title
                  ? "border-rose-500 focus-visible:ring-rose-500/20"
                  : "border-border/50 bg-muted/30"
              }
            />
            {errors.title && (
              <p className="text-xs text-rose-500">{errors.title}</p>
            )}
          </div>

          {/* Status & Priority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Durum
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as TaskStatus)}
              >
                <SelectTrigger className="border-border/50 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Öncelik
              </Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
              >
                <SelectTrigger className="border-border/50 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {TASK_PRIORITIES.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assignees */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Sorumlular
            </Label>
            {canAssign ? (
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto rounded-md border border-border/50 bg-muted/30 p-1">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={assignees.includes(member.name)}
                      onChange={() => toggleAssignee(member.name)}
                      className="accent-primary"
                    />
                    {member.name}
                  </label>
                ))}
              </div>
            ) : (
              <p className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 text-sm">
                {assignees.length > 0 ? assignees.join(", ") : "—"}
              </p>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Son Tarih
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
              <CalendarIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border-none bg-transparent text-sm text-foreground focus:outline-none"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Etiketler
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 transition-all focus-within:ring-1 focus-within:ring-primary/30">
              <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Etiket ekleyin ve Enter'a basın..."
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag()
                  }
                }}
                className="flex-1 border-none bg-transparent text-sm placeholder:text-muted-foreground/50 focus:outline-none"
              />
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="flex h-6 items-center gap-1 border-primary/20 bg-primary/10 pr-1 pl-2 text-[10px] text-primary"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <SheetFooter className="gap-2 border-t border-border/40 pt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            İptal
          </Button>
          <Button onClick={handleSave} className="flex-1 gap-2">
            <SaveIcon className="size-4" />
            Değişiklikleri Kaydet
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
