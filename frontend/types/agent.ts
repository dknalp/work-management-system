export interface AgentTool {
  id: string
  name: string
  label: string
  description: string
  enabled: boolean
  config?: Record<string, unknown>
}

export interface AgentPermissions {
  canReadFiles: boolean
  canWriteFiles: boolean
  canSendEmails: boolean
  canAccessCalendar: boolean
  canManageTeam: boolean
  canViewAnalytics: boolean
  canExecuteCode: boolean
  canMakeAPIRequests: boolean
  allowedDomains: string[]
}

export interface AgentSchedule {
  type: "cron" | "interval"
  value: string
  intervalUnit: "minutes" | "hours" | "days"
  enabled: boolean
}

export interface AIAgent {
  id: string
  name: string
  description: string
  model: string
  systemPrompt: string
  temperature: number
  maxTokens: number
  responseFormat: "markdown" | "json" | "plain"
  tools: AgentTool[]
  permissions: AgentPermissions
  schedule: AgentSchedule
  createdAt: string
  status: "active" | "inactive" | "draft"
}

export const DEFAULT_TOOLS: AgentTool[] = [
  {
    id: "web_search",
    name: "web_search",
    label: "Web Search",
    description: "Search the web for up-to-date information",
    enabled: false,
  },
  {
    id: "code_exec",
    name: "code_exec",
    label: "Code Execution",
    description: "Run Python or JavaScript code in a sandboxed environment",
    enabled: false,
  },
  {
    id: "file_read",
    name: "file_read",
    label: "File Read",
    description: "Read files from the workspace file system",
    enabled: false,
  },
  {
    id: "file_write",
    name: "file_write",
    label: "File Write",
    description: "Create or modify files in the workspace",
    enabled: false,
  },
  {
    id: "email_send",
    name: "email_send",
    label: "Email Send",
    description: "Send emails on behalf of the team",
    enabled: false,
  },
  {
    id: "calendar_access",
    name: "calendar_access",
    label: "Calendar Access",
    description: "Read and write calendar events",
    enabled: false,
  },
  {
    id: "api_request",
    name: "api_request",
    label: "API Request",
    description: "Make HTTP requests to external APIs",
    enabled: false,
  },
  {
    id: "db_query",
    name: "db_query",
    label: "Database Query",
    description: "Run read-only queries against the workspace database",
    enabled: false,
  },
]

export const DEFAULT_PERMISSIONS: AgentPermissions = {
  canReadFiles: false,
  canWriteFiles: false,
  canSendEmails: false,
  canAccessCalendar: false,
  canManageTeam: false,
  canViewAnalytics: false,
  canExecuteCode: false,
  canMakeAPIRequests: false,
  allowedDomains: [],
}

export const DEFAULT_SCHEDULE: AgentSchedule = {
  type: "interval",
  value: "30",
  intervalUnit: "minutes",
  enabled: false,
}

export function createDefaultAgent(id: string, name: string, description: string): AIAgent {
  return {
    id,
    name,
    description,
    model: "claude-opus-5",
    systemPrompt: "",
    temperature: 0.7,
    maxTokens: 4096,
    responseFormat: "markdown",
    tools: DEFAULT_TOOLS.map((t) => ({ ...t })),
    permissions: { ...DEFAULT_PERMISSIONS, allowedDomains: [] },
    schedule: { ...DEFAULT_SCHEDULE },
    createdAt: new Date().toISOString(),
    status: "draft",
  }
}