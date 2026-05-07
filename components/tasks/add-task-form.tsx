"use client"

import { useState } from "react"
import {
  PlusIcon,
  XIcon,
  TagIcon,
  CalendarIcon,
  ChevronDownIcon,
} from "lucide-react"
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
} from "./task-types"
import { format } from "date-fns"

interface AddTaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (task: Task) => void
}

export function AddTaskForm({ open, onOpenChange, onAdd }: AddTaskFormProps) {
  const [title, setTitle] = useState("")
  const [status, setStatus] = useState<TaskStatus>("todo")
  const [priority, setPriority] = useState<TaskPriority>("medium")
  const [assignee, setAssignee] = useState("")
  const [dueDate, setDueDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [errors, setErrors] = useState<{ title?: string; assignee?: string }>(
    {}
  )

  const validate = () => {
    const e: typeof errors = {}
    if (!title.trim()) e.title = "Title is required"
    if (!assignee.trim()) e.assignee = "Assignee is required"
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    const newTask: Task = {
      id: `TASK-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      title: title.trim(),
      status,
      priority,
      assignee: assignee.trim(),
      dueDate,
      tags,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    onAdd(newTask)
    resetForm()
    onOpenChange(false)
  }

  const resetForm = () => {
    setTitle("")
    setStatus("todo")
    setPriority("medium")
    setAssignee("")
    setDueDate(format(new Date(), "yyyy-MM-dd"))
    setTagInput("")
    setTags([])
    setErrors({})
  }

  const addTag = () => {
    const trimmed = tagInput.trim().replace(/^#/, "")
    if (trimmed && !tags.includes(trimmed)) setTags([...tags, trimmed])
    setTagInput("")
  }

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag))

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) resetForm()
      }}
    >
      <SheetContent className="flex flex-col sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add New Task</SheetTitle>
          <SheetDescription>
            Fill in the details below to create a new task.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto py-6 pr-1">
          {/* Title */}
          <div className="space-y-2">
            <Label
              htmlFor="add-title"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Title <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="add-title"
              placeholder="Task title..."
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
                Status
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
                Priority
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

          {/* Assignee */}
          <div className="space-y-2">
            <Label
              htmlFor="add-assignee"
              className="text-xs font-semibold tracking-wider text-muted-foreground uppercase"
            >
              Assignee <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="add-assignee"
              placeholder="Full name..."
              value={assignee}
              onChange={(e) => {
                setAssignee(e.target.value)
                setErrors((p) => ({ ...p, assignee: undefined }))
              }}
              className={
                errors.assignee
                  ? "border-rose-500 focus-visible:ring-rose-500/20"
                  : "border-border/50 bg-muted/30"
              }
            />
            {errors.assignee && (
              <p className="text-xs text-rose-500">{errors.assignee}</p>
            )}
          </div>

          {/* Due Date */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Due Date
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
              Tags
            </Label>
            <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-2 transition-all focus-within:ring-1 focus-within:ring-primary/30">
              <TagIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                type="text"
                placeholder="Add tag and press Enter..."
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
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1 gap-2">
            <PlusIcon className="size-4" />
            Add Task
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
