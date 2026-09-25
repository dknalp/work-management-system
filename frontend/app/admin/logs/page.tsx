"use client"

import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useAuth } from "@/contexts/auth-context"
import { usePermission } from "@/hooks/use-permission"
import { AccessDenied } from "@/components/auth/access-denied"
import { apiClient } from "@/lib/api"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  ArrowLeftIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  AlertCircleIcon,
  InfoIcon,
  BugIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"

type LogLevel = "DEBUG" | "INFO" | "WARNING" | "ERROR" | "CRITICAL"
type LogFile = "app" | "errors"

interface LogEntry {
  ts: string
  level: LogLevel
  logger: string
  msg: string
  exc?: string
  [key: string]: unknown
}

interface LogSummary {
  counts: { WARNING: number; ERROR: number; CRITICAL: number }
  log_dir: string
  files: { "app.log": boolean; "errors.log": boolean }
}

const LEVEL_CONFIG: Record<LogLevel, { color: string; bg: string; icon: React.ReactNode }> = {
  DEBUG:    { color: "text-slate-400",  bg: "bg-slate-500/10",  icon: <BugIcon className="h-3 w-3" /> },
  INFO:     { color: "text-blue-400",   bg: "bg-blue-500/10",   icon: <InfoIcon className="h-3 w-3" /> },
  WARNING:  { color: "text-amber-400",  bg: "bg-amber-500/10",  icon: <AlertTriangleIcon className="h-3 w-3" /> },
  ERROR:    { color: "text-rose-400",   bg: "bg-rose-500/10",   icon: <AlertCircleIcon className="h-3 w-3" /> },
  CRITICAL: { color: "text-red-300",    bg: "bg-red-600/20",    icon: <AlertCircleIcon className="h-3 w-3" /> },
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
  } catch {
    return ts
  }
}

export default function LogsPage() {
  const { user } = useAuth()
  const canView = usePermission("admin:view") || user?.is_admin

  const [entries, setEntries] = useState<LogEntry[]>([])
  const [summary, setSummary] = useState<LogSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [level, setLevel] = useState<LogLevel>("WARNING")
  const [file, setFile] = useState<LogFile>("app")
  const [lines, setLines] = useState("200")
  const [q, setQ] = useState("")
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetchLogs = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ level, file, lines })
      if (q.trim()) params.set("q", q.trim())
      const data = await apiClient<LogEntry[]>(`/api/v1/logs?${params}`)
      setEntries(data)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load logs"
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [level, file, lines, q])

  const fetchSummary = useCallback(async () => {
    try {
      const data = await apiClient<LogSummary>("/api/v1/logs/summary")
      setSummary(data)
    } catch {
      // non-fatal
    }
  }, [])

  useEffect(() => {
    if (!canView) return
    fetchLogs()
    fetchSummary()
  }, [canView, fetchLogs, fetchSummary])

  if (!canView) return <AccessDenied />

  return (
    <AppShellDynamic>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeftIcon className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl font-semibold">System Logs</h1>
            <p className="text-sm text-muted-foreground">
              {summary?.log_dir ?? "/data/logs"} — warnings and errors persisted across restarts
            </p>
          </div>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-3 gap-3">
            {(["WARNING", "ERROR", "CRITICAL"] as const).map((lvl) => {
              const cfg = LEVEL_CONFIG[lvl]
              return (
                <button
                  key={lvl}
                  onClick={() => { setLevel(lvl); fetchLogs() }}
                  className={cn(
                    "rounded-lg border p-4 text-left transition-all hover:ring-1 ring-inset ring-border",
                    cfg.bg
                  )}
                >
                  <div className={cn("text-2xl font-bold tabular-nums", cfg.color)}>
                    {summary.counts[lvl]}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{lvl} (last 1000 lines)</div>
                </button>
              )
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={level} onValueChange={(v) => setLevel(v as LogLevel)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Level" />
            </SelectTrigger>
            <SelectContent>
              {(["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] as LogLevel[]).map((l) => (
                <SelectItem key={l} value={l}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={file} onValueChange={(v) => setFile(v as LogFile)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="File" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="app">app.log</SelectItem>
              <SelectItem value="errors">errors.log</SelectItem>
            </SelectContent>
          </Select>

          <Select value={lines} onValueChange={setLines}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Lines" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50 lines</SelectItem>
              <SelectItem value="200">200 lines</SelectItem>
              <SelectItem value="500">500 lines</SelectItem>
              <SelectItem value="2000">2000 lines</SelectItem>
            </SelectContent>
          </Select>

          <Input
            className="w-52"
            placeholder="Search..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && fetchLogs()}
          />

          <Button onClick={fetchLogs} disabled={loading} size="sm" className="gap-1.5">
            <RefreshCwIcon className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            {loading ? "Loading..." : "Refresh"}
          </Button>
        </div>

        {/* Error state */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Log entries */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {entries.length === 0 && !loading ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No log entries found matching the current filters.
            </div>
          ) : (
            <div className="divide-y divide-border font-mono text-xs">
              {entries.map((entry, idx) => {
                const cfg = LEVEL_CONFIG[entry.level] ?? LEVEL_CONFIG.DEBUG
                const isExpanded = expandedIdx === idx
                const extras = Object.entries(entry).filter(
                  ([k]) => !["ts", "level", "logger", "msg", "exc"].includes(k)
                )
                return (
                  <div
                    key={idx}
                    className={cn(
                      "px-4 py-2 hover:bg-muted/50 cursor-pointer transition-colors",
                      isExpanded && "bg-muted/30"
                    )}
                    onClick={() => setExpandedIdx(isExpanded ? null : idx)}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-muted-foreground shrink-0 pt-0.5 w-36">
                        {formatTs(entry.ts)}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn("shrink-0 gap-1 text-[10px] border-0", cfg.bg, cfg.color)}
                      >
                        {cfg.icon}
                        {entry.level}
                      </Badge>
                      <span className="text-muted-foreground shrink-0 hidden md:block truncate max-w-[180px]">
                        {entry.logger}
                      </span>
                      <span className="flex-1 min-w-0 break-words">{entry.msg}</span>
                    </div>
                    {isExpanded && (
                      <div className="mt-2 ml-0 space-y-1">
                        {entry.exc && (
                          <pre className="text-rose-400 text-[10px] whitespace-pre-wrap bg-rose-950/20 rounded p-2 overflow-x-auto">
                            {entry.exc}
                          </pre>
                        )}
                        {extras.length > 0 && (
                          <pre className="text-slate-400 text-[10px] bg-muted rounded p-2 overflow-x-auto">
                            {JSON.stringify(Object.fromEntries(extras), null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          Showing newest {entries.length} entries · click a row to expand · logs rotate at 10 MB
        </p>
      </div>
    </AppShellDynamic>
  )
}
