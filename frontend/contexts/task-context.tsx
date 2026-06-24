"use client"

import React, { createContext, useContext, useState, useCallback } from "react"
import { Task, MOCK_TASKS } from "@/components/tasks/task-types"

interface TaskContextValue {
  tasks: Task[]
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  deleteTasks: (ids: string[]) => void
}

const TaskContext = createContext<TaskContextValue | null>(null)

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(MOCK_TASKS)

  const addTask = useCallback((task: Task) => {
    setTasks((prev) => [task, ...prev])
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
  }, [])

  const deleteTask = useCallback((id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const deleteTasks = useCallback((ids: string[]) => {
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
  }, [])

  return (
    <TaskContext.Provider value={{ tasks, addTask, updateTask, deleteTask, deleteTasks }}>
      {children}
    </TaskContext.Provider>
  )
}

export function useTasks() {
  const ctx = useContext(TaskContext)
  if (!ctx) throw new Error("useTasks must be used inside TaskProvider")
  return ctx
}
