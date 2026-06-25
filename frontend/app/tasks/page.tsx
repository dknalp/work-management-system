"use client"

import React, { useState, useEffect } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { TaskTable } from "@/components/tasks/task-table"
import { Task } from "@/types/task"
import { TaskDetailModal } from "@/components/tasks/task-detail-modal"
import { QuickAddTask } from "@/components/tasks/quick-add-task"
import { useTasks } from "@/contexts/task-context"
import { toast } from "sonner"

export default function TasksPage() {
  const { tasks, addTask, updateTask, deleteTask, deleteTasks } = useTasks()
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const handleAdd = (task: Task) => {
    addTask(task)
    toast.success("Task created", { description: task.title })
  }

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
              <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
              {mounted && <p className="text-sm text-muted-foreground mt-1">{tasks.length} task{tasks.length !== 1 ? "s" : ""}</p>}
            </div>
            <div className="mb-6">
              <QuickAddTask onAdd={handleAdd} />
            </div>
            <TaskTable
              initialData={tasks}
              onRowClick={(task) => setSelectedTask(task)}
              onDelete={deleteTask}
              onDeleteMany={deleteTasks}
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