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
  assignee: string
  dueDate: string
  tags: string[]
  createdAt: string
  subTasks?: SubTask[]
  description?: string
  comments?: Comment[]
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

export const MOCK_TASKS: Task[] = [
  {
    id: "TASK-001",
    title: "Redesign onboarding flow for new users",
    status: "in-progress",
    priority: "high",
    assignee: "Alex Johnson",
    dueDate: "2026-05-10",
    tags: ["design", "ux"],
    createdAt: "2026-04-20",
    subTasks: [],
  },
  {
    id: "TASK-002",
    title: "Implement JWT refresh token mechanism",
    status: "todo",
    priority: "high",
    assignee: "Sarah Chen",
    dueDate: "2026-05-08",
    tags: ["backend", "security"],
    createdAt: "2026-04-21",
    subTasks: [],
  },
  {
    id: "TASK-003",
    title: "Write unit tests for payment module",
    status: "todo",
    priority: "medium",
    assignee: "Marcus Webb",
    dueDate: "2026-05-15",
    tags: ["testing", "backend"],
    createdAt: "2026-04-22",
    subTasks: [],
  },
  {
    id: "TASK-004",
    title: "Migrate database to PostgreSQL 16",
    status: "in-progress",
    priority: "high",
    assignee: "Priya Nair",
    dueDate: "2026-05-12",
    tags: ["database", "devops"],
    createdAt: "2026-04-18",
    subTasks: [],
  },
  {
    id: "TASK-005",
    title: "Create reusable date-picker component",
    status: "done",
    priority: "medium",
    assignee: "Alex Johnson",
    dueDate: "2026-04-30",
    tags: ["ui", "frontend"],
    createdAt: "2026-04-15",
    subTasks: [],
  },
  {
    id: "TASK-006",
    title: "Set up CI/CD pipeline with GitHub Actions",
    status: "done",
    priority: "high",
    assignee: "Marcus Webb",
    dueDate: "2026-04-28",
    tags: ["devops", "ci-cd"],
    createdAt: "2026-04-14",
    subTasks: [],
  },
  {
    id: "TASK-007",
    title: "Add dark mode support to dashboard",
    status: "todo",
    priority: "low",
    assignee: "Sarah Chen",
    dueDate: "2026-05-20",
    tags: ["ui", "design"],
    createdAt: "2026-04-23",
    subTasks: [],
  },
  {
    id: "TASK-008",
    title: "Optimize image loading with lazy load",
    status: "todo",
    priority: "medium",
    assignee: "Priya Nair",
    dueDate: "2026-05-18",
    tags: ["performance", "frontend"],
    createdAt: "2026-04-24",
    subTasks: [],
  },
  {
    id: "TASK-009",
    title: "Integrate Stripe webhook handling",
    status: "in-progress",
    priority: "high",
    assignee: "Alex Johnson",
    dueDate: "2026-05-06",
    tags: ["backend", "payments"],
    createdAt: "2026-04-25",
    subTasks: [],
  },
  {
    id: "TASK-010",
    title: "Audit and fix accessibility issues",
    status: "todo",
    priority: "medium",
    assignee: "Marcus Webb",
    dueDate: "2026-05-22",
    tags: ["a11y", "frontend"],
    createdAt: "2026-04-26",
    subTasks: [],
  },
  {
    id: "TASK-011",
    title: "Document REST API endpoints with OpenAPI",
    status: "done",
    priority: "low",
    assignee: "Sarah Chen",
    dueDate: "2026-04-29",
    tags: ["documentation", "backend"],
    createdAt: "2026-04-16",
    subTasks: [],
  },
  {
    id: "TASK-012",
    title: "Implement real-time notifications via WebSocket",
    status: "todo",
    priority: "high",
    assignee: "Priya Nair",
    dueDate: "2026-05-25",
    tags: ["backend", "realtime"],
    createdAt: "2026-04-27",
    subTasks: [],
  },
]