"use client"

import React, { useRef, useCallback, useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { KanbanBoard } from "@/components/dashboard/board/kanban-board"
import { usePipelines } from "@/contexts/pipeline-context"
import { useProjects } from "@/contexts/project-context"
import { PROJECT_COLORS } from "@/types/project"
import { cn } from "@/lib/utils"
import Link from "next/link"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  KanbanIcon,
  PlusIcon,
  ArrowLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

function useKanbanStats(storageKey: string) {
  const [stats, setStats] = useState({ total: 0, done: 0, progress: 0 })

  useEffect(() => {
    function compute() {
      try {
        const raw = localStorage.getItem(storageKey)
        if (!raw) { setStats({ total: 0, done: 0, progress: 0 }); return }
        const data = JSON.parse(raw)
        const cards: { status: string }[] = Array.isArray(data.cards) ? data.cards : []
        const total = cards.length
        const done = cards.filter((c) => c.status === "done").length
        setStats({ total, done, progress: total > 0 ? Math.round((done / total) * 100) : 0 })
      } catch {
        setStats({ total: 0, done: 0, progress: 0 })
      }
    }
    compute()
    window.addEventListener("storage", compute)
    window.addEventListener("wms:kanban-changed", compute)
    return () => {
      window.removeEventListener("storage", compute)
      window.removeEventListener("wms:kanban-changed", compute)
    }
  }, [storageKey])

  return stats
}

export default function PipelinePage() {
  const params = useParams<{ id: string }>()
  const { pipelines } = usePipelines()
  const { projects } = useProjects()

  const pipeline = pipelines.find((p) => p.id === params.id)
  const project = pipeline ? projects.find((p) => p.id === pipeline.projectId) : undefined
  const kanbanKey = pipeline ? `wms:kanban:pipeline-${pipeline.id}` : ""

  const { total, done, progress } = useKanbanStats(kanbanKey)

  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [columnTitle, setColumnTitle] = useState("")
  const addColumnFnRef = useRef<((title: string) => void) | null>(null)

  const handleAddColumnReady = useCallback((fn: (title: string) => void) => {
    addColumnFnRef.current = fn
  }, [])

  function confirmAddColumn() {
    const trimmed = columnTitle.trim()
    if (!trimmed) return
    addColumnFnRef.current?.(trimmed)
    setAddColumnOpen(false)
    setColumnTitle("")
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
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {!pipeline ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-4">
              <KanbanIcon className="size-12 text-muted-foreground/40" />
              <div>
                <p className="text-lg font-semibold">Pipeline bulunamadı</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bu pipeline mevcut değil veya silinmiş olabilir.
                </p>
              </div>
              <Link
                href="/pipelines"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ArrowLeftIcon className="size-3.5" />
                {"Pipeline'lara dön"}
              </Link>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Breadcrumb */}
                  {project && (
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
                      <Link
                        href="/pipelines"
                        className="hover:text-foreground transition-colors shrink-0"
                      >
                        {"Pipeline'lar"}
                      </Link>
                      <ChevronRightIcon className="size-3.5 shrink-0" />
                      <Link
                        href={`/projects/${project.slug}?view=pipelines`}
                        className="flex items-center gap-1.5 hover:text-foreground transition-colors min-w-0"
                      >
                        <span
                          className={cn(
                            "size-5 rounded flex items-center justify-center text-[10px] shrink-0",
                            PROJECT_COLORS[project.color]
                          )}
                        >
                          {project.emoji}
                        </span>
                        <span className="truncate">{project.name}</span>
                      </Link>
                      <ChevronRightIcon className="size-3.5 shrink-0" />
                    </div>
                  )}

                  <div className="flex items-center gap-2 min-w-0">
                    <KanbanIcon className="size-4 text-muted-foreground shrink-0" />
                    <h2 className="text-lg font-bold tracking-tight truncate">
                      {pipeline.name}
                    </h2>
                  </div>

                  {/* Progress */}
                  {total > 0 && (
                    <div className="hidden sm:flex items-center gap-2 ml-2 pl-3 border-l border-border/50">
                      <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {done}/{total}
                      </span>
                    </div>
                  )}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 shrink-0"
                  onClick={() => {
                    setColumnTitle("")
                    setAddColumnOpen(true)
                  }}
                >
                  <PlusIcon className="size-3.5" />
                  Sütun Ekle
                </Button>
              </div>

              {/* Board */}
              <div className="flex-1 overflow-hidden">
                <KanbanBoard
                  storageKey={kanbanKey}
                  onAddColumn={handleAddColumnReady}
                />
              </div>
            </>
          )}
        </main>
      </SidebarInset>

      {/* Add Column Dialog */}
      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Sütun Ekle</DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label
              htmlFor="col-title"
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Sütun adı
            </Label>
            <input
              id="col-title"
              type="text"
              value={columnTitle}
              onChange={(e) => setColumnTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmAddColumn()}
              placeholder="örn. İnceleme, Engellendi, QA…"
              autoFocus
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddColumnOpen(false)}>
              İptal
            </Button>
            <Button size="sm" onClick={confirmAddColumn} disabled={!columnTitle.trim()}>
              Sütun Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}