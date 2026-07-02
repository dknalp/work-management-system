"use client"

import { useState } from "react"
import Link from "next/link"
import { usePipelines } from "@/contexts/pipeline-context"
import { useProjects } from "@/contexts/project-context"
import { Pipeline } from "@/types/pipeline"
import { PROJECT_COLORS } from "@/types/project"
import { CreatePipelineDialog } from "./create-pipeline-dialog"
import { cn } from "@/lib/utils"
import {
  KanbanIcon,
  PlusIcon,
  ArrowRightIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"

interface PipelinesListProps {
  projectId?: string
  showProjectBadge?: boolean
}

function RenameInline({
  value,
  onConfirm,
  onCancel,
}: {
  value: string
  onConfirm: (v: string) => void
  onCancel: () => void
}) {
  const [val, setVal] = useState(value)
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { const t = val.trim(); if (t) onConfirm(t); else onCancel() }
        if (e.key === "Escape") onCancel()
        e.stopPropagation()
      }}
      onBlur={() => { const t = val.trim(); if (t) onConfirm(t); else onCancel() }}
      onClick={(e) => e.preventDefault()}
      className="flex-1 min-w-0 bg-transparent text-sm font-semibold outline-none border-b border-border"
    />
  )
}

export function PipelinesList({ projectId, showProjectBadge = true }: PipelinesListProps) {
  const { pipelines, deletePipeline, renamePipeline } = usePipelines()
  const { projects } = useProjects()
  const [createOpen, setCreateOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const list = projectId
    ? pipelines.filter((p) => p.projectId === projectId)
    : pipelines

  const sorted = [...list].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  async function handleDelete(pipeline: Pipeline) {
    try {
      await deletePipeline(pipeline.id)
      toast.success(`"${pipeline.name}" silindi`)
    } catch {
      toast.error("Pipeline silinemedi")
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KanbanIcon className="size-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {projectId ? "Bu Projenin Pipeline'ları" : "Tüm Pipeline'lar"}
            </h3>
            <span className="flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {list.length}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <PlusIcon className="size-3.5" />
            Yeni Pipeline
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-14 rounded-2xl bg-card ring-1 ring-foreground/10 text-center">
            <KanbanIcon className="size-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-semibold">Henüz pipeline yok</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                {"Pipeline'lar, projen içindeki farklı iş akışlarını (sprint, roadmap, backlog) düzenlemenizi sağlar."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mt-1"
            >
              <PlusIcon className="size-4" />
              {"İlk Pipeline'ı Oluştur"}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sorted.map((pipeline) => {
              const project = projects.find((p) => p.id === pipeline.projectId)
              return (
                <div
                  key={pipeline.id}
                  className="group relative flex flex-col gap-3 rounded-2xl bg-card ring-1 ring-foreground/10 p-5 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center justify-center size-9 rounded-xl bg-muted shrink-0">
                      <KanbanIcon className="size-4 text-muted-foreground" />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="size-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <MoreHorizontalIcon className="size-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={() => setRenamingId(pipeline.id)}>
                          <PencilIcon className="size-3.5 mr-2" />
                          Yeniden Adlandır
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(pipeline)}
                        >
                          <Trash2Icon className="size-3.5 mr-2" />
                          Sil
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    {renamingId === pipeline.id ? (
                      <RenameInline
                        value={pipeline.name}
                        onConfirm={(v) => { renamePipeline(pipeline.id, v).catch(() => null); setRenamingId(null) }}
                        onCancel={() => setRenamingId(null)}
                      />
                    ) : (
                      <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                        {pipeline.name}
                      </p>
                    )}

                    {showProjectBadge && project && (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span
                          className={cn(
                            "size-4 rounded flex items-center justify-center text-[10px] shrink-0",
                            PROJECT_COLORS[project.color]
                          )}
                        >
                          {project.emoji}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {project.name}
                        </span>
                      </div>
                    )}

                    <p className="text-[11px] text-muted-foreground mt-1">
                      {new Date(pipeline.createdAt).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Footer link */}
                  <Link
                    href={`/pipelines/${pipeline.id}`}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-auto"
                  >
                    <span>Aç</span>
                    <ArrowRightIcon className="size-3 group-hover:translate-x-0.5 transition-transform" />
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <CreatePipelineDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultProjectId={projectId}
      />
    </>
  )
}