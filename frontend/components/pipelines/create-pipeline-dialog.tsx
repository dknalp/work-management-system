"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { useProjects } from "@/contexts/project-context"
import { usePipelines } from "@/contexts/pipeline-context"
import { PROJECT_COLORS } from "@/types/project"
import { cn } from "@/lib/utils"
import { ArrowRightIcon, ArrowLeftIcon, KanbanIcon } from "lucide-react"

interface CreatePipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultProjectId?: string
}

export function CreatePipelineDialog({
  open,
  onOpenChange,
  defaultProjectId,
}: CreatePipelineDialogProps) {
  const router = useRouter()
  const { projects } = useProjects()
  const { createPipeline } = usePipelines()

  const [step, setStep] = useState<1 | 2>(defaultProjectId ? 2 : 1)
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? "")
  const [name, setName] = useState("")

  function handleClose() {
    onOpenChange(false)
    setTimeout(() => {
      setStep(defaultProjectId ? 2 : 1)
      setSelectedProjectId(defaultProjectId ?? "")
      setName("")
    }, 200)
  }

  function handleCreate() {
    if (!selectedProjectId || !name.trim()) return
    const pipeline = createPipeline(selectedProjectId, name.trim())
    handleClose()
    router.push(`/pipelines/${pipeline.id}`)
  }

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <KanbanIcon className="size-4 text-muted-foreground" />
            Yeni Pipeline
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("font-medium", step === 1 ? "text-foreground" : "")}>
            1. Proje seç
          </span>
          <ArrowRightIcon className="size-3" />
          <span className={cn("font-medium", step === 2 ? "text-foreground" : "")}>
            2. İsim ver
          </span>
        </div>

        {step === 1 && (
          <div className="space-y-2 py-1">
            <Label className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Proje
            </Label>
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                Önce bir proje oluşturman gerekiyor.
              </p>
            ) : (
              <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
                {projects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => setSelectedProjectId(project.id)}
                    className={cn(
                      "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors border",
                      selectedProjectId === project.id
                        ? "bg-primary/5 border-primary/40 text-foreground"
                        : "border-transparent hover:bg-muted text-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "size-7 rounded-md flex items-center justify-center text-sm shrink-0",
                        PROJECT_COLORS[project.color]
                      )}
                    >
                      {project.emoji}
                    </span>
                    <span className="text-sm font-medium truncate">{project.name}</span>
                    {selectedProjectId === project.id && (
                      <span className="ml-auto text-primary text-xs font-semibold">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3 py-1">
            {selectedProject && (
              <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <span
                  className={cn(
                    "size-6 rounded flex items-center justify-center text-xs shrink-0",
                    PROJECT_COLORS[selectedProject.color]
                  )}
                >
                  {selectedProject.emoji}
                </span>
                <span className="text-sm text-muted-foreground truncate">
                  {selectedProject.name}
                </span>
              </div>
            )}
            <div className="space-y-1.5">
              <Label
                htmlFor="pipeline-name"
                className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
              >
                Pipeline adı
              </Label>
              <input
                id="pipeline-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="örn. Sprint 1, Q3 Roadmap, Bug Backlog…"
                autoFocus
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleClose}>
            İptal
          </Button>
          {step === 1 ? (
            <Button
              size="sm"
              onClick={() => setStep(2)}
              disabled={!selectedProjectId}
              className="gap-1.5"
            >
              İleri
              <ArrowRightIcon className="size-3.5" />
            </Button>
          ) : (
            <div className="flex gap-2">
              {!defaultProjectId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep(1)}
                  className="gap-1.5"
                >
                  <ArrowLeftIcon className="size-3.5" />
                  Geri
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!name.trim()}
                className="gap-1.5"
              >
                <KanbanIcon className="size-3.5" />
                Oluştur
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}