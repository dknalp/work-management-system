export type ProjectColor =
  | "red"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "gray"

export interface Project {
  id: string
  name: string
  slug: string
  color: ProjectColor
  emoji: string
  isPinned: boolean
  isExpanded: boolean
  createdAt: string
}

export type ProjectView = "pipelines" | "folders" | "tasks"

export const PROJECT_COLORS: Record<ProjectColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  yellow: "bg-yellow-500",
  green: "bg-green-500",
  blue: "bg-blue-500",
  purple: "bg-purple-500",
  pink: "bg-pink-500",
  gray: "bg-gray-500",
}