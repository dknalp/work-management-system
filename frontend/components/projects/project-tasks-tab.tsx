"use client"

import { useMemo, useState } from "react"
import { TaskTable } from "@/components/tasks/task-table"
import { QuickAddTask } from "@/components/tasks/quick-add-task"
import { TaskDetailModal } from "@/components/tasks/task-detail-modal"
import { useTasks } from "@/contexts/task-context"
import { Task } from "@/types/task"
import { toast } from "sonner"

export function ProjectTasksTab({ projectId }: { projectId: string }) {
  const { tasks, addTask, updateTask, deleteTask, deleteTasks } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  const projectTasks = useMemo(
    () => tasks.filter((t) => t.projectId === projectId),
    [tasks, projectId]
  )

  function handleAdd(task: Task) {
    addTask({ ...task, projectId })
    toast.success("Görev oluşturuldu", { description: task.title })
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-6 flex flex-col gap-6">
        <QuickAddTask onAdd={handleAdd} />
        <TaskTable
          initialData={projectTasks}
          onRowClick={(task) => setSelectedTask(task)}
          onDelete={deleteTask}
          onDeleteMany={deleteTasks}
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