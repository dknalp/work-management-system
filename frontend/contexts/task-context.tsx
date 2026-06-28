"use client"

import React, { createContext, useContext, useCallback, useEffect, useState } from "react"
import { Task } from "@/types/task"
import { apiClient } from "@/lib/api"
import { useAuth, type User } from "@/contexts/auth-context"

export type ActivityType =
  | "task_created"
  | "task_completed"
  | "task_reopened"
  | "task_status_changed"
  | "task_deleted"
  | "task_updated"

export type ActivityEntry = {
  id: string
  type: ActivityType
  taskId: string
  taskTitle: string
  detail?: string
  timestamp: string
  userId?: string | null
  userName?: string | null
}

type ApiActivity = {
  id: string
  type: string
  task_id: string
  task_title: string
  detail?: string | null
  timestamp: string
  user_id?: string | null
  user_name?: string | null
}

interface TaskContextValue {
  tasks: Task[]
  loading: boolean
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  deleteTasks: (ids: string[]) => void
  activity: ActivityEntry[]
  refreshActivity: () => void
}

const TaskContext = createContext<TaskContextValue | null>(null)

function toApiTask(task: Task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assignee: task.assignee,
    due_date: task.dueDate || null,
    tags: task.tags,
    description: task.description,
    created_at: task.createdAt,
  }
}

type ApiTask = {
  id: string
  title: string
  status: string
  priority: string
  assignee: string
  due_date?: string | null
  tags?: string[] | null
  description?: string | null
  created_at: string
}

function fromApiTask(t: ApiTask): Task {
  return {
    id: t.id,
    title: t.title,
    status: t.status as Task["status"],
    priority: t.priority as Task["priority"],
    assignee: t.assignee,
    dueDate: t.due_date ?? "",
    tags: t.tags ?? [],
    description: t.description ?? undefined,
    createdAt: t.created_at,
  }
}

function fromApiActivity(a: ApiActivity): ActivityEntry {
  return {
    id: a.id,
    type: a.type as ActivityType,
    taskId: a.task_id,
    taskTitle: a.task_title,
    detail: a.detail ?? undefined,
    timestamp: a.timestamp,
    userId: a.user_id ?? null,
    userName: a.user_name ?? null,
  }
}

async function pushActivity(
  type: ActivityType,
  task: Pick<Task, "id" | "title">,
  user: User | null,
  detail?: string
) {
  await apiClient("/activity", {
    method: "POST",
    body: JSON.stringify({
      id: crypto.randomUUID(),
      type,
      task_id: task.id,
      task_title: task.title,
      detail: detail ?? null,
      timestamp: new Date().toISOString(),
      user_id: user?.id ?? null,
      user_name: user?.name ?? null,
    }),
  }).catch(() => {})
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<ActivityEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchTasks = useCallback(async () => {
    try {
      const data = await apiClient<ApiTask[]>("/tasks")
      setTasks(data.map(fromApiTask))
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchActivity = useCallback(async () => {
    try {
      const data = await apiClient<ApiActivity[]>("/activity?limit=200")
      setActivity(data.map(fromApiActivity))
    } catch {
      // keep previous state on error
    }
  }, [])

  useEffect(() => {
    fetchTasks()
    fetchActivity()
  }, [fetchTasks, fetchActivity])

  const addTask = useCallback(
    async (task: Task) => {
      try {
        const created = await apiClient<ApiTask>("/tasks", {
          method: "POST",
          body: JSON.stringify(toApiTask(task)),
        })
        setTasks((prev) => [fromApiTask(created), ...prev])
        await pushActivity("task_created", task, user)
        setActivity((prev) => [
          {
            id: crypto.randomUUID(),
            type: "task_created",
            taskId: task.id,
            taskTitle: task.title,
            timestamp: new Date().toISOString(),
            userId: user?.id ?? null,
            userName: user?.name ?? null,
          },
          ...prev,
        ])
      } catch {
        // revert on error — refetch
        fetchTasks()
      }
    },
    [user, fetchTasks]
  )

  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
      )

      const apiUpdates: Record<string, unknown> = {}
      if (updates.title !== undefined) apiUpdates.title = updates.title
      if (updates.status !== undefined) apiUpdates.status = updates.status
      if (updates.priority !== undefined) apiUpdates.priority = updates.priority
      if (updates.assignee !== undefined) apiUpdates.assignee = updates.assignee
      if (updates.dueDate !== undefined) apiUpdates.due_date = updates.dueDate || null
      if (updates.tags !== undefined) apiUpdates.tags = updates.tags
      if (updates.description !== undefined) apiUpdates.description = updates.description

      try {
        await apiClient(`/tasks/${id}`, {
          method: "PUT",
          body: JSON.stringify(apiUpdates),
        })

        const currentTask = tasks.find((t) => t.id === id)
        if (currentTask) {
          let actType: ActivityType = "task_updated"
          let detail: string | undefined
          if (updates.status !== undefined && updates.status !== currentTask.status) {
            if (updates.status === "done") actType = "task_completed"
            else if (currentTask.status === "done") actType = "task_reopened"
            else {
              actType = "task_status_changed"
              detail = `${currentTask.status} → ${updates.status}`
            }
          }
          await pushActivity(actType, { id, title: currentTask.title }, user, detail)
          await fetchActivity()
        }
      } catch {
        fetchTasks()
      }
    },
    [tasks, user, fetchTasks, fetchActivity]
  )

  const deleteTask = useCallback(
    async (id: string) => {
      const task = tasks.find((t) => t.id === id)
      setTasks((prev) => prev.filter((t) => t.id !== id))
      try {
        await apiClient(`/tasks/${id}`, { method: "DELETE" })
        if (task) {
          await pushActivity("task_deleted", task, user)
          await fetchActivity()
        }
      } catch {
        fetchTasks()
      }
    },
    [tasks, user, fetchTasks, fetchActivity]
  )

  const deleteTasks = useCallback(
    async (ids: string[]) => {
      const toDelete = tasks.filter((t) => ids.includes(t.id))
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
      try {
        await Promise.all(
          ids.map((id) => apiClient(`/tasks/${id}`, { method: "DELETE" }))
        )
        await Promise.all(
          toDelete.map((task) => pushActivity("task_deleted", task, user))
        )
        await fetchActivity()
      } catch {
        fetchTasks()
      }
    },
    [tasks, user, fetchTasks, fetchActivity]
  )

  return (
    <TaskContext.Provider
      value={{ tasks, loading, addTask, updateTask, deleteTask, deleteTasks, activity, refreshActivity: fetchActivity }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error("useTasks must be used inside TaskProvider")
  return ctx
}