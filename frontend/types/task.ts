export type TaskStatus = "todo" | "in-progress" | "done"
export type TaskPriority = "low" | "medium" | "high"

export type SubTask = {
  id: string
  title: string
  completed: boolean
}

export type Reply = {
  id: string
  authorName: string
  authorAvatar?: string
  body: string
  createdAt: string
}

export type Comment = {
  id: string
  authorName: string
  authorAvatar?: string
  body: string
  createdAt: string
  replies?: Reply[]
}

export type Task = {
  id: string
  title: string
  status: TaskStatus
  priority: TaskPriority
  assignees: string[]
  dueDate: string
  tags: string[]
  createdAt: string
  completedAt?: string
  subTasks?: SubTask[]
  description?: string
  comments?: Comment[]
  projectId?: string
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

