"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Task,
  TaskPriority,
  TaskStatus,
  SubTask,
  TASK_STATUSES,
  TASK_PRIORITIES,
} from "@/components/tasks/task-types";

const TEAM_NAMES = ["Alex Johnson", "Sarah Chen", "Marcus Webb", "Priya Patel", "Jordan Kim"];

interface QuickAddTaskProps {
  onAdd: (task: Task) => void;
}

export function QuickAddTask({ onAdd }: QuickAddTaskProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(TASK_STATUSES[0].value);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pendingSubTasks, setPendingSubTasks] = useState<SubTask[]>([]);
  const [subTaskInput, setSubTaskInput] = useState("");
  const [description, setDescription] = useState("");

  const filteredNames = assignee.trim()
    ? TEAM_NAMES.filter((n) => n.toLowerCase().includes(assignee.toLowerCase()))
    : [];

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      status,
      priority,
      assignee: assignee.trim(),
      dueDate,
      tags: [],
      subTasks: pendingSubTasks,
      createdAt: new Date().toISOString(),
      description,
    });
    setTitle("");
    setStatus(TASK_STATUSES[0].value);
    setPriority("medium");
    setAssignee("");
    setDueDate("");
    setPendingSubTasks([]);
    setSubTaskInput("");
    setDescription("");
    setIsExpanded(false);
    titleRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && title.trim()) {
      handleSubmit();
    } else if (e.key === "Escape") {
      setIsExpanded(false);
      setTitle("");
      titleRef.current?.blur();
    }
  }

  function handleAssigneeKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, filteredNames.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0) {
        e.preventDefault();
        setAssignee(filteredNames[activeIndex]);
        setShowDropdown(false);
        setActiveIndex(-1);
      }
    } else if (e.key === "Escape") {
      setShowDropdown(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <Plus size={18} className="shrink-0 text-muted-foreground" />
        <input
          ref={titleRef}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setIsExpanded(true)}
          onKeyDown={handleKeyDown}
          placeholder="What needs to be done?"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {title.trim() && (
          <Button size="sm" onClick={handleSubmit}>
            Add task
          </Button>
        )}
      </div>
      <div
        className={cn(
          "grid transition-all duration-300 ease-in-out",
          isExpanded ? "[grid-template-rows:1fr]" : "[grid-template-rows:0fr]"
        )}
      >
        <div className="overflow-hidden min-h-0">
          <div className="flex flex-wrap items-center gap-2 pt-3 pb-1">
            <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
              <SelectTrigger className="h-7 w-[130px] text-sm">
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
            <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
              <SelectTrigger className="h-7 w-[120px] text-sm">
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
            <div className="relative">
              <Input
                placeholder="Assignee"
                value={assignee}
                onChange={(e) => {
                  setAssignee(e.target.value);
                  setShowDropdown(true);
                  setActiveIndex(-1);
                }}
                onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                onKeyDown={handleAssigneeKeyDown}
                className="h-7 w-32 text-sm"
              />
              {showDropdown && assignee.trim() && filteredNames.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-border bg-card shadow-md">
                  {filteredNames.map((name, i) => (
                    <button
                      key={name}
                      onMouseDown={() => {
                        setAssignee(name);
                        setShowDropdown(false);
                      }}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-sm hover:bg-accent",
                        i === activeIndex && "bg-accent"
                      )}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-7 w-36 text-sm"
            />
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {pendingSubTasks.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {pendingSubTasks.map((st) => (
                  <span
                    key={st.id}
                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                  >
                    {st.title}
                    <button
                      onClick={() =>
                        setPendingSubTasks((prev) => prev.filter((s) => s.id !== st.id))
                      }
                      className="hover:text-destructive"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <input
              value={subTaskInput}
              onChange={(e) => setSubTaskInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.stopPropagation();
                  if (subTaskInput.trim()) {
                    setPendingSubTasks((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), title: subTaskInput.trim(), completed: false },
                    ]);
                    setSubTaskInput("");
                  }
                }
              }}
              placeholder="Add sub-task… (Enter for each)"
              className="h-7 w-full rounded border border-border bg-transparent px-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add description…"
            rows={2}
            className="mt-2 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault(); // prevent bare Enter from submitting the task form; Shift+Enter allows newlines
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}