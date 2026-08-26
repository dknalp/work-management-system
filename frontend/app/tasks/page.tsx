"use client"

import React, { useState } from "react"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { TaskTable } from "@/components/tasks/task-table"
import { Task } from "@/types/task"
import { TaskDetailModal } from "@/components/tasks/task-detail-modal"
import { QuickAddTask } from "@/components/tasks/quick-add-task"
import { useTasks } from "@/contexts/task-context"
import { usePermission } from "@/hooks/use-permission"
import { AccessDenied } from "@/components/auth/access-denied"
import { toast } from "sonner"

export default function TasksPage() {
  const canView = usePermission("tasks:view")
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  /** Delete multiple tasks in sequence. */
  const deleteMany = async (ids: string[]) => {
    await Promise.all(ids.map((id) => deleteTask(id)))
  }

  const handleAdd = async (task: Task) => {
    const created = await createTask({
      title: task.title,
      status: task.status,
      priority: task.priority,
      assignees: task.assignees ?? [],
      due_date: task.due_date,
      tags: task.tags ?? [],
      description: task.description,
    })
    if (created) toast.success("Görev oluşturuldu", { description: created.title })
  }

  if (!canView) return (
    <AppShellDynamic>
      <main className="flex flex-1 items-center justify-center"><AccessDenied /></main>
    </AppShellDynamic>
  )

  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8 md:py-10">
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">Görevler</h1>
              {!loading && <p className="text-sm text-muted-foreground mt-1">{tasks.length} görev</p>}
            </div>
            <div className="mb-6">
              <QuickAddTask onAdd={handleAdd} />
            </div>
            <TaskTable
              initialData={tasks}
              onRowClick={(task) => setSelectedTask(task)}
              onDelete={deleteTask}
              onDeleteMany={deleteMany}
              onStatusChange={(id, status) => updateTask(id, { status })}
            />
          </div>
        </main>
      <TaskDetailModal
        task={selectedTask}
        open={selectedTask !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedTask(null)
        }}
        onTaskChange={(updated) => {
          updateTask(updated.id, updated)
          setSelectedTask(updated)
        }}
      />
    </AppShellDynamic>
  )
}