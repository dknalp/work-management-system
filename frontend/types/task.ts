/**
 * Canonical Task types for the tasks page and backend API.
 *
 * These types mirror the Firestore ``tasks`` collection schema defined in
 * backend/app/models.py.  The Kanban board no longer maintains a separate
 * task model — it uses these same Task records (by ID) for its columns.
 *
 * Do NOT add frontend-only fields here.  If you need transient UI state
 * (e.g. "isEditing"), keep it in local component state.
 */

export type TaskStatus = "todo" | "in-progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export type SubTask = {
  id: string
  title: string
  completed: boolean
}

export type Reply = {
  id: string
  /** Firebase UID of the author. */
  author_id: string
  author_name: string
  author_avatar?: string
  body: string
  /** ISO datetime string. */
  created_at: string
}

export type Comment = {
  id: string
  /** Firebase UID of the author. */
  author_id: string
  author_name: string
  author_avatar?: string
  body: string
  /** ISO datetime string. */
  created_at: string
  replies: Reply[]
}

export type Task = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  /** List of display names or UIDs assigned to this task. */
  assignees: string[]
  /** ISO date string "YYYY-MM-DD". */
  due_date?: string
  tags: string[]
  /** ISO datetime string — set when status transitions to "done". */
  created_at: string
  completed_at?: string
  updated_at?: string
  description?: string
  sub_tasks: SubTask[]
  comments: Comment[]
  project_id?: string
}

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: "todo", label: "Todo" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
]

export const TASK_PRIORITIES: { value: TaskPriority; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
]