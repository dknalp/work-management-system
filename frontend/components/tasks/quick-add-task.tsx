"use client";

import { useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
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
} from "@/types/task";
import { useTeam } from "@/contexts/team-context";

interface QuickAddTaskProps {
  onAdd: (task: Task) => void;
}

export function QuickAddTask({ onAdd }: QuickAddTaskProps) {
  const canCreate = usePermission("tasks:create")
  const canAssign = usePermission("tasks:assign")
  const { members } = useTeam();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [status, setStatus] = useState<TaskStatus>(TASK_STATUSES[0].value);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [assignees, setAssignees] = useState<string[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [showAssigneeDropdown, setShowAssigneeDropdown] = useState(false);
  const [pendingSubTasks, setPendingSubTasks] = useState<SubTask[]>([]);
  const [subTaskInput, setSubTaskInput] = useState("");
  const [description, setDescription] = useState("");

  if (!canCreate) return null;

  function toggleAssignee(name: string) {
    setAssignees((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  function handleSubmit() {
    if (!title.trim()) return;
    onAdd({
      id: crypto.randomUUID(),
      title: title.trim(),
      status,
      priority,
      assignees,
      dueDate,
      tags: [],
      subTasks: pendingSubTasks,
      createdAt: new Date().toISOString(),
      description,
    });
    setTitle("");
    setStatus(TASK_STATUSES[0].value);
    setPriority("medium");
    setAssignees([]);
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
          placeholder="Ne yapılması gerekiyor?"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {title.trim() && (
          <Button size="sm" onClick={handleSubmit}>
            Görev ekle
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
            {canAssign && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowAssigneeDropdown((v) => !v)}
                  onBlur={() => setTimeout(() => setShowAssigneeDropdown(false), 150)}
                  className={cn(
                    "h-7 min-w-[96px] rounded-md border border-input bg-muted/30 px-2.5 text-left text-sm text-muted-foreground hover:bg-muted",
                    assignees.length > 0 && "text-foreground"
                  )}
                >
                  {assignees.length === 0
                    ? "Sorumlu"
                    : assignees.length === 1
                    ? assignees[0].split(" ")[0]
                    : `${assignees.length} kişi`}
                </button>
                {showAssigneeDropdown && (
                  <div className="absolute top-full left-0 z-50 mt-1 w-48 rounded-md border border-border bg-card shadow-md">
                    {members.map((member) => (
                      <button
                        key={member.id}
                        onMouseDown={() => toggleAssignee(member.name)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent",
                          assignees.includes(member.name) && "bg-accent/60"
                        )}
                      >
                        <span className={cn(
                          "size-3.5 rounded-sm border border-input flex items-center justify-center shrink-0",
                          assignees.includes(member.name) && "bg-primary border-primary"
                        )}>
                          {assignees.includes(member.name) && (
                            <svg viewBox="0 0 10 10" className="size-2.5 fill-primary-foreground">
                              <path d="M2 5l2.5 2.5 3.5-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                            </svg>
                          )}
                        </span>
                        {member.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
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
              placeholder="Alt görev ekle… (Her biri için Enter)"
              className="h-7 w-full rounded border border-border bg-transparent px-2 text-sm placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Açıklama ekle…"
            rows={2}
            className="mt-2 resize-none text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}