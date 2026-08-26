"use client"

import React, { useState } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
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
    <SidebarProvider
      style={{ "--sidebar-width": "calc(var(--spacing) * 64)", "--header-height": "calc(var(--spacing) * 14)" } as React.CSSProperties}
    >
      <AppSidebar variant="inset" />
      <SidebarInset><SiteHeader /><main className="flex flex-1 items-center justify-center"><AccessDenied /></main></SidebarInset>
    </SidebarProvider>
  )

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
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
      </SidebarInset>
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
    </SidebarProvider>
  )
}