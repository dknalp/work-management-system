"use client"

import React, { useState } from "react"
import { useParams, useSearchParams, useRouter } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ProjectOverviewTab } from "@/components/projects/project-overview-tab"
import { ProjectTasksTab } from "@/components/projects/project-tasks-tab"
import { PipelinesList } from "@/components/pipelines/pipelines-list"
import { useProjects } from "@/contexts/project-context"
import { useTasks } from "@/contexts/task-context"
import { PROJECT_COLORS } from "@/types/project"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  CheckSquareIcon,
  PlusIcon,
  ArrowLeftIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  KanbanIcon,
} from "lucide-react"

const TABS = [
  { key: "overview", label: "Genel Bakış", Icon: LayoutDashboardIcon },
  { key: "pipelines", label: "Pipeline'lar", Icon: KanbanIcon },
  { key: "tasks", label: "Görevler", Icon: CheckSquareIcon },
] as const

type TabKey = (typeof TABS)[number]["key"]

export default function ProjectPage() {
  const params = useParams<{ slug: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()
  const { projects } = useProjects()
  const { tasks } = useTasks()

  const view = (searchParams.get("view") as TabKey) || "overview"
  const project = projects.find((p) => p.slug === params.slug)

  const projectTasks = project ? tasks.filter((t) => t.projectId === project.id) : []
  const total = projectTasks.length
  const done = projectTasks.filter((t) => t.status === "done").length
  const progress = total > 0 ? Math.round((done / total) * 100) : 0

  function setView(tab: TabKey) {
    router.replace(`/projects/${params.slug}?view=${tab}`)
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
          {!project ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-4">
              <FolderOpenIcon className="size-12 text-muted-foreground/40" />
              <div>
                <p className="text-lg font-semibold">Proje bulunamadı</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Bu proje mevcut değil veya silinmiş olabilir.
                </p>
              </div>
              <Link
                href="/analytics"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ArrowLeftIcon className="size-3.5" />
                Panoya dön
              </Link>
            </div>
          ) : (
            <>
              {/* Project header */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "size-9 rounded-xl flex items-center justify-center text-base shrink-0",
                      PROJECT_COLORS[project.color]
                    )}
                  >
                    {project.emoji}
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold tracking-tight truncate">{project.name}</h2>
                    <p className="text-xs text-muted-foreground">
                      Oluşturulma:{" "}
                      {new Date(project.createdAt).toLocaleDateString("tr-TR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Progress pill */}
                  {total > 0 && (
                    <div className="hidden sm:flex items-center gap-2 ml-3 pl-3 border-l border-border/50">
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

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="h-8 gap-1.5"
                    onClick={() => setView("tasks")}
                  >
                    <PlusIcon className="size-3.5" />
                    Görev Ekle
                  </Button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-0 border-b border-border/50 px-6">
                {TABS.map(({ key, label, Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setView(key)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors",
                      view === key
                        ? "border-primary text-foreground"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                    )}
                  >
                    <Icon className="size-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-hidden">
                {view === "overview" && (
                  <div className="h-full overflow-y-auto">
                    <ProjectOverviewTab projectId={project.id} />
                  </div>
                )}

                {view === "pipelines" && (
                  <div className="h-full overflow-y-auto p-6">
                    <PipelinesList projectId={project.id} showProjectBadge={false} />
                  </div>
                )}

                {view === "tasks" && (
                  <ProjectTasksTab projectId={project.id} />
                )}

                              </div>
            </>
          )}
        </main>
      </SidebarInset>

    </SidebarProvider>
  )
}