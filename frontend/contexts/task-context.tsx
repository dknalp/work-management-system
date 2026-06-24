"use client"

import React, { createContext, useContext, useCallback } from "react"
import { Task, MOCK_TASKS } from "@/components/tasks/task-types"
import { useLocalStorage } from "@/lib/use-local-storage"

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
  timestamp: string // ISO
}

interface TaskContextValue {
  tasks: Task[]
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  deleteTasks: (ids: string[]) => void
  activity: ActivityEntry[]
}

const TaskContext = createContext<TaskContextValue | null>(null)

function makeActivity(
  type: ActivityType,
  task: Pick<Task, "id" | "title">,
  detail?: string
): ActivityEntry {
  return {
    id: crypto.randomUUID(),
    type,
    taskId: task.id,
    taskTitle: task.title,
    detail,
    timestamp: new Date().toISOString(),
  }
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useLocalStorage<Task[]>("wms:tasks", MOCK_TASKS)
  const [activity, setActivity] = useLocalStorage<ActivityEntry[]>("wms:activity", [])

  const pushActivity = useCallback((entry: ActivityEntry) => {
    setActivity((prev) => [entry, ...prev].slice(0, 50))
  }, [])

  const addTask = useCallback(
    (task: Task) => {
      setTasks((prev) => [task, ...prev])
      pushActivity(makeActivity("task_created", task))
    },
    [pushActivity]
  )

  const updateTask = useCallback(
    (id: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== id) return t
          const next = { ...t, ...updates }
          if (updates.status !== undefined && updates.status !== t.status) {
            if (updates.status === "done") {
              pushActivity(makeActivity("task_completed", next))
            } else if (t.status === "done") {
              pushActivity(makeActivity("task_reopened", next))
            } else {
              pushActivity(
                makeActivity("task_status_changed", next, `${t.status} → ${updates.status}`)
              )
            }
          } else if (Object.keys(updates).length > 0) {
            pushActivity(makeActivity("task_updated", next))
          }
          return next
        })
      )
    },
    [pushActivity]
  )

  const deleteTask = useCallback(
    (id: string) => {
      setTasks((prev) => {
        const task = prev.find((t) => t.id === id)
        if (task) pushActivity(makeActivity("task_deleted", task))
        return prev.filter((t) => t.id !== id)
      })
    },
    [pushActivity]
  )

  const deleteTasks = useCallback(
    (ids: string[]) => {
      setTasks((prev) => {
        const toDelete = prev.filter((t) => ids.includes(t.id))
        toDelete.forEach((task) =>
          pushActivity(makeActivity("task_deleted", task))
        )
        return prev.filter((t) => !ids.includes(t.id))
      })
    },
    [pushActivity]
  )

  return (
    <TaskContext.Provider
      value={{ tasks, addTask, updateTask, deleteTask, deleteTasks, activity }}
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