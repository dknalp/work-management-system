"use client"

/**
 * Task context — single source of truth for the tasks feature.
 *
 * All state is derived from the backend API (Firestore via FastAPI).
 * localStorage is NOT used for task data — tasks must survive browser clears
 * and must be visible across devices.
 *
 * The context exposes:
 *   - tasks            — the canonical list of Task objects
 *   - loading          — true while the initial fetch is in flight
 *   - error            — non-null when the last fetch failed
 *   - createTask       — POST /api/v1/tasks
 *   - updateTask       — PATCH /api/v1/tasks/:id
 *   - deleteTask       — DELETE /api/v1/tasks/:id
 *   - addComment       — POST /api/v1/tasks/:id/comments
 *   - deleteComment    — DELETE /api/v1/tasks/:id/comments/:commentId
 *   - addReply         — POST /api/v1/tasks/:id/comments/:commentId/replies
 *   - addSubTask       — POST /api/v1/tasks/:id/subtasks
 *   - updateSubTask    — PATCH /api/v1/tasks/:id/subtasks/:subtaskId
 *   - deleteSubTask    — DELETE /api/v1/tasks/:id/subtasks/:subtaskId
 *   - logActivity      — POST /api/v1/activity
 *   - activity         — recent activity log entries fetched from the backend
 *   - refreshTasks     — re-fetch the full task list from the backend
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react"
import { toast } from "sonner"
import { apiClient } from "@/lib/api"
import { cacheGet, cacheSet, cacheInvalidate } from "@/lib/query-cache"
import type { Task, SubTask, Comment, Reply } from "@/types/task"
import { useAuth } from "./auth-context"

// ── Activity log types ────────────────────────────────────────────────────────

export type ActivityType =
  | "task_created"
  | "task_updated"
  | "task_deleted"
  | "task_completed"
  | "comment_added"
  | "subtask_added"
  | "subtask_completed"

export type ActivityEntry = {
  id: string
  type: ActivityType
  task_id?: string
  task_title?: string
  detail?: string
  /** ISO datetime string */
  timestamp: string
  user_id: string
  user_name: string
}

// ── Context shape ─────────────────────────────────────────────────────────────

type TaskContextValue = {
  tasks: Task[]
  activity: ActivityEntry[]
  loading: boolean
  error: string | null

  /** Re-fetch the full task list from the backend. */
  refreshTasks: () => Promise<void>

  /** Create a new task.  Returns the created task on success, null on failure. */
  createTask: (
    data: Omit<Task, "id" | "created_at" | "sub_tasks" | "comments">
  ) => Promise<Task | null>

  /** Update fields on an existing task.  Returns the updated task on success. */
  updateTask: (
    id: string,
    data: Partial<Omit<Task, "id" | "created_at">>
  ) => Promise<Task | null>

  /** Permanently delete a task. */
  deleteTask: (id: string) => Promise<boolean>

  /** Add a comment to a task.  Returns the new comment on success. */
  addComment: (taskId: string, body: string) => Promise<Comment | null>

  /** Delete a comment. */
  deleteComment: (taskId: string, commentId: string) => Promise<boolean>

  /** Add a reply to a comment. */
  addReply: (
    taskId: string,
    commentId: string,
    body: string
  ) => Promise<Reply | null>

  /** Add a sub-task checklist item. */
  addSubTask: (taskId: string, title: string) => Promise<SubTask | null>

  /** Update a sub-task (title or completion state). */
  updateSubTask: (
    taskId: string,
    subtaskId: string,
    data: Partial<Pick<SubTask, "title" | "completed">>
  ) => Promise<SubTask | null>

  /** Delete a sub-task. */
  deleteSubTask: (taskId: string, subtaskId: string) => Promise<boolean>

  /** Write an activity log entry to the backend. */
  logActivity: (
    data: Pick<ActivityEntry, "type" | "task_id" | "task_title" | "detail">
  ) => Promise<void>
}

// ── Context ───────────────────────────────────────────────────────────────────

const TaskContext = createContext<TaskContextValue | null>(null)

export function useTasks(): TaskContextValue {
  const ctx = useContext(TaskContext)
  if (!ctx) {
    throw new Error("useTasks must be used inside <TaskProvider>")
  }
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  // Seed state from cache immediately so pages render without a loading spinner
  // on repeat visits. The background refresh below keeps data fresh.
  const [tasks, setTasks] = useState<Task[]>(() => cacheGet<Task[]>("tasks") ?? [])
  const [activity, setActivity] = useState<ActivityEntry[]>(() => cacheGet<ActivityEntry[]>("activity") ?? [])
  const [loading, setLoading] = useState(() => cacheGet<Task[]>("tasks") === null)
  const [error, setError] = useState<string | null>(null)

  /**
   * Wrapper around setTasks that also writes the new state to the session
   * cache so that the next page mount renders from the latest data rather
   * than a snapshot that predates the mutation.
   *
   * Accepts the same updater-function or direct-value signature as useState's
   * setter, but always resolves to the final array before caching.
   */
  const setTasksAndCache = useCallback(
    (updater: Task[] | ((prev: Task[]) => Task[])) => {
      setTasks((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater
        cacheSet("tasks", next)
        return next
      })
    },
    []
  )

  // ── Fetch tasks from backend ───────────────────────────────────────────────

  const refreshTasks = useCallback(async (silent = false) => {
    // In silent mode (background refresh from cache hit) we skip the loading
    // spinner so the UI never flickers while data is already visible.
    if (!silent) setLoading(true)
    setError(null)
    try {
      const raw = await apiClient<Task[]>("/api/v1/tasks")
      // Normalise array fields that may be absent on legacy Firestore documents.
      // Every component that consumes tasks relies on these being real arrays.
      const data = raw.map((t) => ({
        ...t,
        tags: t.tags ?? [],
        assignees: t.assignees ?? [],
        sub_tasks: t.sub_tasks ?? [],
        comments: t.comments ?? [],
      }))
      setTasks(data)
      cacheSet("tasks", data)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load tasks"
      setError(message)
      // Do not toast here — the calling page will show an error state if needed.
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // ── Fetch activity log from backend ───────────────────────────────────────

  const refreshActivity = useCallback(async () => {
    try {
      const data = await apiClient<ActivityEntry[]>("/api/v1/activity")
      setActivity(data)
      cacheSet("activity", data)
    } catch {
      // Activity is non-critical; silently ignore fetch failures.
    }
  }, [])

  // ── Initial load — only fetch when a user is authenticated ─────────────────
  // Uses user?.id (not the full user object) as the dependency so that Firebase
  // token refreshes (which create a new user object reference) do not trigger
  // a full re-fetch. Only an actual login/logout changes user?.id.
  useEffect(() => {
    if (!user?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTasks([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivity([])
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false)
      cacheInvalidate("tasks")
      cacheInvalidate("activity")
      return
    }
    // If we already have cached data, refresh silently in the background.
    const hasCachedTasks = cacheGet<Task[]>("tasks") !== null
    refreshTasks(hasCachedTasks)
    refreshActivity()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ── CRUD operations ────────────────────────────────────────────────────────

  const createTask = useCallback(
    async (
      data: Omit<Task, "id" | "created_at" | "sub_tasks" | "comments">
    ): Promise<Task | null> => {
      try {
        const created = await apiClient<Task>("/api/v1/tasks", {
          method: "POST",
          body: JSON.stringify(data),
        })
        setTasksAndCache((prev) => [created, ...prev])
        return created
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to create task"
        toast.error(message)
        return null
      }
    },
    []
  )

  const updateTask = useCallback(
    async (
      id: string,
      data: Partial<Omit<Task, "id" | "created_at">>
    ): Promise<Task | null> => {
      try {
        const updated = await apiClient<Task>(`/api/v1/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(data),
        })
        setTasksAndCache((prev) =>
          prev.map((t) => (t.id === id ? updated : t))
        )
        return updated
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update task"
        toast.error(message)
        return null
      }
    },
    []
  )

  const deleteTask = useCallback(async (id: string): Promise<boolean> => {
    try {
      await apiClient(`/api/v1/tasks/${id}`, { method: "DELETE" })
      setTasksAndCache((prev) => prev.filter((t) => t.id !== id))
      return true
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete task"
      toast.error(message)
      return false
    }
  }, [])

  // ── Comments ───────────────────────────────────────────────────────────────

  const addComment = useCallback(
    async (taskId: string, body: string): Promise<Comment | null> => {
      try {
        const comment = await apiClient<Comment>(
          `/api/v1/tasks/${taskId}/comments`,
          { method: "POST", body: JSON.stringify({ body }) }
        )
        setTasksAndCache((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, comments: [...(t.comments ?? []), comment] }
              : t
          )
        )
        return comment
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add comment"
        toast.error(message)
        return null
      }
    },
    []
  )

  const deleteComment = useCallback(
    async (taskId: string, commentId: string): Promise<boolean> => {
      try {
        await apiClient(`/api/v1/tasks/${taskId}/comments/${commentId}`, {
          method: "DELETE",
        })
        setTasksAndCache((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  comments: (t.comments ?? []).filter(
                    (c) => c.id !== commentId
                  ),
                }
              : t
          )
        )
        return true
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete comment"
        toast.error(message)
        return false
      }
    },
    []
  )

  const addReply = useCallback(
    async (
      taskId: string,
      commentId: string,
      body: string
    ): Promise<Reply | null> => {
      try {
        const reply = await apiClient<Reply>(
          `/api/v1/tasks/${taskId}/comments/${commentId}/replies`,
          { method: "POST", body: JSON.stringify({ body }) }
        )
        setTasksAndCache((prev) =>
          prev.map((t) => {
            if (t.id !== taskId) return t
            return {
              ...t,
              comments: (t.comments ?? []).map((c) =>
                c.id === commentId
                  ? { ...c, replies: [...(c.replies ?? []), reply] }
                  : c
              ),
            }
          })
        )
        return reply
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add reply"
        toast.error(message)
        return null
      }
    },
    []
  )

  // ── Sub-tasks ──────────────────────────────────────────────────────────────

  const addSubTask = useCallback(
    async (taskId: string, title: string): Promise<SubTask | null> => {
      try {
        const subtask = await apiClient<SubTask>(
          `/api/v1/tasks/${taskId}/subtasks`,
          { method: "POST", body: JSON.stringify({ title }) }
        )
        setTasksAndCache((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? { ...t, sub_tasks: [...(t.sub_tasks ?? []), subtask] }
              : t
          )
        )
        return subtask
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to add sub-task"
        toast.error(message)
        return null
      }
    },
    []
  )

  const updateSubTask = useCallback(
    async (
      taskId: string,
      subtaskId: string,
      data: Partial<Pick<SubTask, "title" | "completed">>
    ): Promise<SubTask | null> => {
      try {
        const updated = await apiClient<SubTask>(
          `/api/v1/tasks/${taskId}/subtasks/${subtaskId}`,
          { method: "PATCH", body: JSON.stringify(data) }
        )
        setTasksAndCache((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  sub_tasks: (t.sub_tasks ?? []).map((s) =>
                    s.id === subtaskId ? updated : s
                  ),
                }
              : t
          )
        )
        return updated
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to update sub-task"
        toast.error(message)
        return null
      }
    },
    []
  )

  const deleteSubTask = useCallback(
    async (taskId: string, subtaskId: string): Promise<boolean> => {
      try {
        await apiClient(`/api/v1/tasks/${taskId}/subtasks/${subtaskId}`, {
          method: "DELETE",
        })
        setTasksAndCache((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  sub_tasks: (t.sub_tasks ?? []).filter(
                    (s) => s.id !== subtaskId
                  ),
                }
              : t
          )
        )
        return true
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to delete sub-task"
        toast.error(message)
        return false
      }
    },
    []
  )

  // ── Activity log ───────────────────────────────────────────────────────────

  const logActivity = useCallback(
    async (
      data: Pick<ActivityEntry, "type" | "task_id" | "task_title" | "detail">
    ): Promise<void> => {
      try {
        const entry = await apiClient<ActivityEntry>("/api/v1/activity", {
          method: "POST",
          body: JSON.stringify(data),
        })
        setActivity((prev) => [entry, ...prev].slice(0, 100))
      } catch {
        // Activity logging is non-critical — never fail the main operation
        // due to an activity write failure.
      }
    },
    []
  )

  // ── Context value ──────────────────────────────────────────────────────────

  const value: TaskContextValue = {
    tasks,
    activity,
    loading,
    error,
    refreshTasks,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    deleteComment,
    addReply,
    addSubTask,
    updateSubTask,
    deleteSubTask,
    logActivity,
  }

  return <TaskContext.Provider value={value}>{children}</TaskContext.Provider>
}