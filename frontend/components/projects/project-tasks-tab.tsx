"use client"

/** Displays and manages tasks scoped to a specific project. */

import { useMemo, useState } from "react"
import { TaskTable } from "@/components/tasks/task-table"
import { QuickAddTask } from "@/components/tasks/quick-add-task"
import { TaskDetailModal } from "@/components/tasks/task-detail-modal"
import { useTasks } from "@/contexts/task-context"
import { Task } from "@/types/task"
import { toast } from "sonner"

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  const { tasks, createTask, updateTask, deleteTask } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  /** Tasks that belong to this project. */
  const projectTasks = useMemo(
    () => tasks.filter((t) => t.project_id === projectId),
    [tasks, projectId]
  )

  async function handleAdd(task: Task) {
    const created = await createTask({
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignees: task.assignees ?? [],
      due_date: task.due_date,
      tags: task.tags ?? [],
      description: task.description,
      project_id: projectId,
    })
    if (created) toast.success("Görev oluşturuldu", { description: created.title })
  }

  async function deleteMany(ids: string[]) {
    await Promise.all(ids.map((id) => deleteTask(id)))
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        <QuickAddTask onAdd={handleAdd} />
        <TaskTable
          initialData={projectTasks}
          onRowClick={(task) => setSelectedTask(task)}
          onDelete={deleteTask}
          onDeleteMany={deleteMany}
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