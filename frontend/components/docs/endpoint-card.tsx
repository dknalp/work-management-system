"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { CodeBlock } from "./code-block"

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  POST: "bg-green-500/15 text-green-400 border-green-500/30",
  PUT: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  PATCH: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  DELETE: "bg-red-500/15 text-red-400 border-red-500/30",
}

type Param = {
  name: string
  type: string
  required?: boolean
  description: string
}

type CodeExample = {
  curl: string
  python: string
  javascript: string
}

type Props = {
  method: string
  path: string
  description: string
  queryParams?: Param[]
  bodyParams?: Param[]
  responseExample?: string
  codes?: CodeExample
  notes?: string
}

type Tab = "curl" | "python" | "javascript"

export function EndpointCard({
  method,
  path,
  description,
  queryParams,
  bodyParams,
  responseExample,
  codes,
  notes,
}: Props) {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>("curl")

  const colorClass = METHOD_COLORS[method] ?? "bg-zinc-500/15 text-zinc-400"

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
      >
        <span className={cn("shrink-0 rounded border px-2 py-0.5 text-xs font-bold font-mono", colorClass)}>
          {method}
        </span>
        <code className="flex-1 text-sm text-foreground">{path}</code>
        <span className="ml-2 text-xs text-muted-foreground hidden sm:block">{description}</span>
        <ChevronDownIcon
          className={cn("ml-auto size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </button>

      {open && (
        <div className="border-t border-border/40 bg-background/50 px-5 pb-5 pt-4 space-y-4">
          <p className="text-sm text-muted-foreground">{description}</p>

          {notes && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-300">
              {notes}
            </div>
          )}

          {queryParams && queryParams.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Query Parameters</p>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">Parameter</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Required</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {queryParams.map((p) => (
                      <tr key={p.name}>
                        <td className="px-3 py-2 font-mono text-foreground">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.required ? (
                            <span className="text-red-400">Required</span>
                          ) : (
                            <span className="text-muted-foreground">Optional</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {bodyParams && bodyParams.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request Body</p>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/40 bg-muted/30">
                      <th className="px-3 py-2 text-left font-medium">Field</th>
                      <th className="px-3 py-2 text-left font-medium">Type</th>
                      <th className="px-3 py-2 text-left font-medium">Required</th>
                      <th className="px-3 py-2 text-left font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {bodyParams.map((p) => (
                      <tr key={p.name}>
                        <td className="px-3 py-2 font-mono text-foreground">{p.name}</td>
                        <td className="px-3 py-2 text-muted-foreground">{p.type}</td>
                        <td className="px-3 py-2">
                          {p.required ? (
                            <span className="text-red-400">Required</span>
                          ) : (
                            <span className="text-muted-foreground">Optional</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">{p.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {responseExample && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Response</p>
              <CodeBlock code={responseExample} language="json" />
            </div>
          )}

          {codes && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Code Examples</p>
              <div className="flex gap-1 mb-2">
                {(["curl", "python", "javascript"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "rounded px-3 py-1 text-xs font-medium transition-colors",
                      tab === t
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    {t === "curl" ? "cURL" : t === "python" ? "Python" : "JavaScript"}
                  </button>
                ))}
              </div>
              <CodeBlock code={codes[tab]} language={tab === "curl" ? "bash" : tab} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}