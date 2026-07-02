"use client"

import { useEffect, useMemo, useState } from "react"
import { TaskTable } from "@/components/tasks/task-table"
import { QuickAddTask } from "@/components/tasks/quick-add-task"
import { TaskDetailModal } from "@/components/tasks/task-detail-modal"
import { useTasks } from "@/contexts/task-context"
import { Task } from "@/types/task"
import { toast } from "sonner"

const STORAGE_PREFIX = "wms:project-tasks:"

function loadProjectTaskIds(projectId: string): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + projectId)
    return new Set(JSON.parse(raw ?? "[]"))
  } catch {
    return new Set()
  }
}

function saveProjectTaskIds(projectId: string, ids: Set<string>) {
  localStorage.setItem(STORAGE_PREFIX + projectId, JSON.stringify([...ids]))
}

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  const { tasks, addTask, updateTask, deleteTask, deleteTasks } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [projectTaskIds, setProjectTaskIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setProjectTaskIds(loadProjectTaskIds(projectId))
  }, [projectId])

  const projectTasks = useMemo(
    () => tasks.filter((t) => projectTaskIds.has(t.id)),
    [tasks, projectTaskIds]
  )

  function handleAdd(task: Task) {
    const next = new Set(projectTaskIds).add(task.id)
    setProjectTaskIds(next)
    saveProjectTaskIds(projectId, next)
    addTask({ ...task, projectId })
    toast.success("Görev oluşturuldu", { description: task.title })
  }

  function handleDelete(id: string) {
    deleteTask(id)
    const next = new Set(projectTaskIds)
    next.delete(id)
    setProjectTaskIds(next)
    saveProjectTaskIds(projectId, next)
  }

  function handleDeleteMany(ids: string[]) {
    deleteTasks(ids)
    const next = new Set(projectTaskIds)
    ids.forEach((id) => next.delete(id))
    setProjectTaskIds(next)
    saveProjectTaskIds(projectId, next)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        <QuickAddTask onAdd={handleAdd} />
        <TaskTable
          initialData={projectTasks}
          onRowClick={(task) => setSelectedTask(task)}
          onDelete={handleDelete}
          onDeleteMany={handleDeleteMany}
          onStatusChange={(id, status) => updateTask(id, { status })}
        />
      </div>

      <TaskDetailModal
        task={selectedTask}
        open={selectedTask !== null}
        onOpenChange={(open) => { if (!open) setSelectedTask(null) }}
        onTaskChange={(updated) => {
          updateTask(updated.id, updated)
          setSelectedTask(updated)
        }}
      />
    </div>
  )
}