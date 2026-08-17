"use client"

import React, { useState, use } from "react"
import Link from "next/link"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  BotIcon,
  SaveIcon,
  ChevronRightIcon,
  GlobeIcon,
  CodeIcon,
  FileTextIcon,
  MailIcon,
  CalendarIcon,
  ZapIcon,
  DatabaseIcon,
  FolderOpenIcon,
  FolderPenIcon,
  ShieldIcon,
  ClockIcon,
  LayoutDashboardIcon,
  TerminalIcon,
  AlertTriangleIcon,
  PlusIcon,
  XIcon,
  InfoIcon,
} from "lucide-react"
import {
  AIAgent,
  AgentTool,
  AgentPermissions,
  createDefaultAgent,
} from "@/types/agent"
import { cn } from "@/lib/utils"

// ─── Mock agent store (in-memory, replaced by backend later) ────────────────
const MOCK_AGENTS: Record<string, AIAgent> = {
  "1": createDefaultAgent("1", "Support Bot", "Handles customer support queries automatically."),
}

function getAgent(id: string): AIAgent {
  if (MOCK_AGENTS[id]) return MOCK_AGENTS[id]
  return createDefaultAgent(id, `Agent ${id}`, "")
}

// ─── Tool metadata ────────────────────────────────────────────────────────────
const TOOL_ICONS: Record<string, React.ElementType> = {
  web_search: GlobeIcon,
  code_exec: CodeIcon,
  file_read: FolderOpenIcon,
  file_write: FolderPenIcon,
  email_send: MailIcon,
  calendar_access: CalendarIcon,
  api_request: ZapIcon,
  db_query: DatabaseIcon,
}

// ─── Permission rows ──────────────────────────────────────────────────────────
type PermKey = keyof Omit<AgentPermissions, "allowedDomains">

const PERMISSION_ROWS: { key: PermKey; label: string; description: string; icon: React.ElementType }[] = [
  { key: "canReadFiles", label: "Read Files", description: "Access files stored in the workspace", icon: FolderOpenIcon },
  { key: "canWriteFiles", label: "Write Files", description: "Create and modify files in the workspace", icon: FolderPenIcon },
  { key: "canSendEmails", label: "Send Emails", description: "Send emails on behalf of the team", icon: MailIcon },
  { key: "canAccessCalendar", label: "Calendar Access", description: "Read and write calendar events", icon: CalendarIcon },
  { key: "canManageTeam", label: "Manage Team", description: "Add, edit, or remove team members", icon: ShieldIcon },
  { key: "canViewAnalytics", label: "View Analytics", description: "Access analytics and reporting data", icon: LayoutDashboardIcon },
  { key: "canExecuteCode", label: "Execute Code", description: "Run code in a sandboxed environment", icon: TerminalIcon },
  { key: "canMakeAPIRequests", label: "External API Requests", description: "Make HTTP requests to external services", icon: ZapIcon },
]

// ─── Cron preview ─────────────────────────────────────────────────────────────
function parseCronHuman(expr: string): string {
  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return "Invalid expression"
  const [min, hour, dom, , dow] = parts
  if (min === "*" && hour === "*") return "Every minute"
  if (dom === "*" && dow === "*") {
    const h = parseInt(hour, 10)
    const m = parseInt(min, 10)
    if (!isNaN(h) && !isNaN(m)) {
      const timeStr = `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
      return `Daily at ${timeStr}`
    }
  }
  if (dow === "1-5") return `Weekdays at ${hour}:${min.padStart(2, "0")}`
  return expr
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function AgentBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [agent, setAgent] = useState<AIAgent>(() => getAgent(id))
  const [domainInput, setDomainInput] = useState("")

  function update<K extends keyof AIAgent>(key: K, value: AIAgent[K]) {
    setAgent((prev) => ({ ...prev, [key]: value }))
  }

  function updatePermission(key: PermKey, value: boolean) {
    setAgent((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: value },
    }))
  }

  function updateTool(toolId: string, enabled: boolean) {
    setAgent((prev) => ({
      ...prev,
      tools: prev.tools.map((t) => (t.id === toolId ? { ...t, enabled } : t)),
    }))
  }

  function addDomain() {
    const d = domainInput.trim().toLowerCase()
    if (!d || agent.permissions.allowedDomains.includes(d)) return
    setAgent((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, allowedDomains: [...prev.permissions.allowedDomains, d] },
    }))
    setDomainInput("")
  }

  function removeDomain(domain: string) {
    setAgent((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        allowedDomains: prev.permissions.allowedDomains.filter((d) => d !== domain),
      },
    }))
  }

  function handleSave() {
    MOCK_AGENTS[id] = agent
    toast.success("Agent saved", { description: `${agent.name} has been updated.` })
  }

  const statusColor: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
    inactive: "bg-muted text-muted-foreground border-border/40",
    draft: "bg-amber-500/15 text-amber-600 border-amber-500/20",
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
        <main className="flex flex-1 flex-col overflow-auto bg-background/50">
          <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 md:px-8">

            {/* Breadcrumb */}
            <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link href="/team" className="hover:text-foreground transition-colors">Team</Link>
              <ChevronRightIcon className="size-3.5" />
              <span>AI Agents</span>
              <ChevronRightIcon className="size-3.5" />
              <span className="text-foreground font-medium">{agent.name}</span>
            </nav>

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
                  <BotIcon className="size-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">{agent.name}</h1>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("text-[11px] capitalize", statusColor[agent.status])}
                    >
                      {agent.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Created {new Date(agent.createdAt).toLocaleDateString("tr-TR")}
                    </span>
                  </div>
                </div>
              </div>
              <Button onClick={handleSave} className="gap-2 shrink-0">
                <SaveIcon className="size-4" />
                Save Changes
              </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="h-10 gap-0.5 rounded-xl bg-muted/60 p-1">
                <TabsTrigger value="overview" className="rounded-lg px-4 text-sm">Overview</TabsTrigger>
                <TabsTrigger value="instructions" className="rounded-lg px-4 text-sm">Instructions</TabsTrigger>
                <TabsTrigger value="tools" className="rounded-lg px-4 text-sm">Tools</TabsTrigger>
                <TabsTrigger value="permissions" className="rounded-lg px-4 text-sm">Permissions</TabsTrigger>
                <TabsTrigger value="schedule" className="rounded-lg px-4 text-sm">Schedule</TabsTrigger>
              </TabsList>

              {/* ── TAB 1: Overview ── */}
              <TabsContent value="overview" className="space-y-6">
                <Section title="Basic Info" description="Identity and status of this agent">
                  <Field label="Agent Name">
                    <Input
                      value={agent.name}
                      onChange={(e) => update("name", e.target.value)}
                      placeholder="e.g. Support Bot"
                    />
                  </Field>
                  <Field label="Description">
                    <Textarea
                      value={agent.description}
                      onChange={(e) => update("description", e.target.value)}
                      placeholder="What does this agent do?"
                      rows={3}
                    />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Status">
                      <Select
                        value={agent.status}
                        onValueChange={(v) => update("status", v as AIAgent["status"])}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Model">
                      <Select
                        value={agent.model}
                        onValueChange={(v) => update("model", v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="claude-opus-5">Claude Opus 5</SelectItem>
                          <SelectItem value="claude-sonnet-5">Claude Sonnet 5</SelectItem>
                          <SelectItem value="claude-haiku-4-5">Claude Haiku 4.5</SelectItem>
                          <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                          <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                          <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                          <SelectItem value="llama-3-70b">Llama 3 70B</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </Section>
              </TabsContent>

              {/* ── TAB 2: Instructions ── */}
              <TabsContent value="instructions" className="space-y-6">
                <Section title="System Prompt" description="The core instructions given to the agent at the start of every session">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>System Prompt</Label>
                      <span className="text-[11px] text-muted-foreground">
                        {agent.systemPrompt.length} chars
                      </span>
                    </div>
                    <Textarea
                      value={agent.systemPrompt}
                      onChange={(e) => update("systemPrompt", e.target.value)}
                      placeholder="You are a helpful assistant that..."
                      rows={12}
                      className="font-mono text-sm resize-y"
                    />
                  </div>
                </Section>

                <Section title="Generation Settings" description="Control how the model generates responses">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label>Temperature</Label>
                        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-mono">
                          {agent.temperature.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.01}
                        value={agent.temperature}
                        onChange={(e) => update("temperature", parseFloat(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Precise (0)</span>
                        <span>Balanced (1)</span>
                        <span>Creative (2)</span>
                      </div>
                    </div>

                    <Field label="Max Tokens">
                      <Input
                        type="number"
                        min={256}
                        max={128000}
                        step={256}
                        value={agent.maxTokens}
                        onChange={(e) => update("maxTokens", parseInt(e.target.value, 10) || 4096)}
                      />
                    </Field>
                  </div>

                  <Field label="Response Format">
                    <div className="flex gap-2">
                      {(["markdown", "json", "plain"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => update("responseFormat", fmt)}
                          className={cn(
                            "flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-colors",
                            agent.responseFormat === fmt
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/40 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                          )}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                  </Field>
                </Section>
              </TabsContent>

              {/* ── TAB 3: Tools ── */}
              <TabsContent value="tools" className="space-y-6">
                <Section title="Available Tools" description="Choose which tools this agent can use during execution">
                  <div className="space-y-3">
                    {agent.tools.map((tool) => {
                      const Icon = TOOL_ICONS[tool.id] ?? ZapIcon
                      return (
                        <ToolRow
                          key={tool.id}
                          tool={tool}
                          icon={Icon}
                          onToggle={(v) => updateTool(tool.id, v)}
                        />
                      )
                    })}
                  </div>
                </Section>
              </TabsContent>

              {/* ── TAB 4: Permissions ── */}
              <TabsContent value="permissions" className="space-y-6">
                <Section title="Access Permissions" description="Define what actions this agent is allowed to perform">
                  <div className="divide-y divide-border/40">
                    {PERMISSION_ROWS.map((row) => {
                      const Icon = row.icon
                      return (
                        <div key={row.key} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                          <div className="flex items-start gap-3">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                              <Icon className="size-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="text-sm font-medium">{row.label}</p>
                              <p className="text-xs text-muted-foreground">{row.description}</p>
                            </div>
                          </div>
                          <Switch
                            checked={agent.permissions[row.key]}
                            onCheckedChange={(v) => updatePermission(row.key, v)}
                          />
                        </div>
                      )
                    })}
                  </div>
                </Section>

                <Section title="Allowed Domains" description="Restrict which external domains this agent can contact. Leave empty for no restriction.">
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="e.g. api.example.com"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addDomain() } }}
                      />
                      <Button variant="outline" size="icon" onClick={addDomain} className="shrink-0">
                        <PlusIcon className="size-4" />
                      </Button>
                    </div>
                    {agent.permissions.allowedDomains.length === 0 ? (
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <InfoIcon className="size-3.5" />
                        No restriction — agent can contact any domain
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {agent.permissions.allowedDomains.map((d) => (
                          <span
                            key={d}
                            className="flex items-center gap-1 rounded-full border border-border/40 bg-muted/50 px-2.5 py-0.5 text-xs"
                          >
                            {d}
                            <button onClick={() => removeDomain(d)} className="text-muted-foreground hover:text-destructive">
                              <XIcon className="size-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </Section>

                {/* Danger Zone */}
                <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <AlertTriangleIcon className="size-4 text-destructive" />
                    <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
                  </div>
                  <Separator className="bg-destructive/20" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Disable Agent</p>
                      <p className="text-xs text-muted-foreground">The agent will stop running until re-enabled.</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive shrink-0"
                      onClick={() => { update("status", "inactive"); toast.info("Agent disabled") }}
                    >
                      Disable Agent
                    </Button>
                  </div>
                  <Separator className="bg-destructive/20" />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium">Delete Agent</p>
                      <p className="text-xs text-muted-foreground">Permanently delete this agent and all its configuration.</p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="shrink-0"
                      onClick={() => toast.error("Go to Team page to delete an agent")}
                    >
                      Delete Agent
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ── TAB 5: Schedule ── */}
              <TabsContent value="schedule" className="space-y-6">
                <Section title="Automated Schedule" description="Run this agent automatically on a recurring schedule">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Enable Schedule</p>
                      <p className="text-xs text-muted-foreground">Agent will run automatically when enabled</p>
                    </div>
                    <Switch
                      checked={agent.schedule.enabled}
                      onCheckedChange={(v) =>
                        setAgent((prev) => ({ ...prev, schedule: { ...prev.schedule, enabled: v } }))
                      }
                    />
                  </div>

                  {agent.schedule.enabled && (
                    <>
                      <Separator />
                      <Field label="Schedule Type">
                        <div className="flex gap-2">
                          {(["interval", "cron"] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() =>
                                setAgent((prev) => ({ ...prev, schedule: { ...prev.schedule, type: t } }))
                              }
                              className={cn(
                                "flex-1 rounded-lg border py-2 text-xs font-medium capitalize transition-colors",
                                agent.schedule.type === t
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border/40 bg-background/40 text-muted-foreground hover:border-border hover:text-foreground"
                              )}
                            >
                              {t === "interval" ? "Interval" : "Cron Expression"}
                            </button>
                          ))}
                        </div>
                      </Field>

                      {agent.schedule.type === "interval" ? (
                        <div className="grid grid-cols-2 gap-3">
                          <Field label="Every">
                            <Input
                              type="number"
                              min={1}
                              value={agent.schedule.value}
                              onChange={(e) =>
                                setAgent((prev) => ({ ...prev, schedule: { ...prev.schedule, value: e.target.value } }))
                              }
                            />
                          </Field>
                          <Field label="Unit">
                            <Select
                              value={agent.schedule.intervalUnit}
                              onValueChange={(v) =>
                                setAgent((prev) => ({
                                  ...prev,
                                  schedule: { ...prev.schedule, intervalUnit: v as "minutes" | "hours" | "days" },
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="minutes">Minutes</SelectItem>
                                <SelectItem value="hours">Hours</SelectItem>
                                <SelectItem value="days">Days</SelectItem>
                              </SelectContent>
                            </Select>
                          </Field>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Field label="Cron Expression">
                            <Input
                              value={agent.schedule.value}
                              onChange={(e) =>
                                setAgent((prev) => ({ ...prev, schedule: { ...prev.schedule, value: e.target.value } }))
                              }
                              placeholder="0 9 * * 1-5"
                              className="font-mono"
                            />
                          </Field>
                          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <ClockIcon className="size-3.5 shrink-0" />
                            {parseCronHuman(agent.schedule.value)}
                          </p>
                        </div>
                      )}
                    </>
                  )}

                  <Separator />
                  <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
                    <ClockIcon className="size-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-xs font-medium">Last Run</p>
                      <p className="text-xs text-muted-foreground">Never run yet</p>
                    </div>
                  </div>
                </Section>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

// ─── Helper components ────────────────────────────────────────────────────────

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-sm space-y-5">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Separator className="bg-border/40" />
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function ToolRow({
  tool,
  icon: Icon,
  onToggle,
}: {
  tool: AgentTool
  icon: React.ElementType
  onToggle: (enabled: boolean) => void
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors",
        tool.enabled
          ? "border-primary/30 bg-primary/5"
          : "border-border/40 bg-background/40"
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg",
            tool.enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-medium">{tool.label}</p>
          <p className="text-xs text-muted-foreground">{tool.description}</p>
        </div>
      </div>
      <Switch checked={tool.enabled} onCheckedChange={onToggle} />
    </div>
  )
}