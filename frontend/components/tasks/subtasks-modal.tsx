"use client"

import { useState } from "react"
import { ArrowLeft, X } from "lucide-react"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { SubTask } from "@/types/task"

interface SubtasksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  taskTitle: string
  subTasks: SubTask[]
  onSubTasksChange: (subTasks: SubTask[]) => void
}

export function SubtasksModal({ open, onOpenChange, taskTitle, subTasks, onSubTasksChange }: SubtasksModalProps) {
  const [newSubTaskInput, setNewSubTaskInput] = useState("")

  const completedCount = subTasks.filter(st => st.completed).length

  const toggleSubTask = (id: string, completed: boolean) => {
    onSubTasksChange(subTasks.map(st => st.id === id ? { ...st, completed } : st))
  }

  const deleteSubTask = (id: string) => {
    onSubTasksChange(subTasks.filter(st => st.id !== id))
  }

  const addSubTask = () => {
    if (!newSubTaskInput.trim()) return
    onSubTasksChange([...subTasks, { id: crypto.randomUUID(), title: newSubTaskInput.trim(), completed: false }])
    setNewSubTaskInput("")
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addSubTask()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[80vh] w-full max-w-[560px] p-0 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3 shrink-0">
          <button
            onClick={() => onOpenChange(false)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={18} />
          </button>
          <DialogTitle className="text-base font-semibold">Alt Görevler</DialogTitle>
          <span className="ml-auto text-xs text-muted-foreground">{completedCount}/{subTasks.length}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {subTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Henüz alt görev yok.</p>
          ) : (
            <ul className="space-y-0.5">
              {subTasks.map(st => (
                <li key={st.id} className="group flex items-center gap-3 py-1.5">
                  <Checkbox
                    checked={st.completed}
                    onCheckedChange={(checked) => toggleSubTask(st.id, !!checked)}
                  />
                  <span className={cn("flex-1 text-sm", st.completed && "line-through text-muted-foreground")}>
                    {st.title}
                  </span>
                  <button
                    onClick={() => deleteSubTask(st.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-3 flex gap-2 shrink-0">
          <Input
            value={newSubTaskInput}
            onChange={e => setNewSubTaskInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Alt görev ekle…"
            className="flex-1"
          />
          <Button onClick={addSubTask}>Ekle</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}