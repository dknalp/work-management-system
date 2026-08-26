"use client"

/**
 * ProjectsGrid
 *
 * Displays the current user's projects as a responsive card grid.
 * Pinned projects always appear first.
 *
 * Must only be rendered inside a <ClientOnly> boundary — it reads from the
 * project context which is always empty on the server.
 */

import Link from "next/link"
import { useProjects } from "@/contexts/project-context"
import { ProjectColor } from "@/types/project"
import { FolderOpen, ArrowRight, Pin } from "lucide-react"
import { cn } from "@/lib/utils"

const COLOR_TEXT: Record<ProjectColor, string> = {
  red: "text-red-600 dark:text-red-400",
  orange: "text-orange-600 dark:text-orange-400",
  yellow: "text-yellow-600 dark:text-yellow-400",
  green: "text-green-600 dark:text-green-400",
  blue: "text-blue-600 dark:text-blue-400",
  purple: "text-purple-600 dark:text-purple-400",
  pink: "text-pink-600 dark:text-pink-400",
  gray: "text-gray-600 dark:text-gray-400",
}

const COLOR_BG_SOFT: Record<ProjectColor, string> = {
  red: "bg-red-50 dark:bg-red-950/30",
  orange: "bg-orange-50 dark:bg-orange-950/30",
  yellow: "bg-yellow-50 dark:bg-yellow-950/30",
  green: "bg-green-50 dark:bg-green-950/30",
  blue: "bg-blue-50 dark:bg-blue-950/30",
  purple: "bg-purple-50 dark:bg-purple-950/30",
  pink: "bg-pink-50 dark:bg-pink-950/30",
  gray: "bg-gray-50 dark:bg-gray-950/30",
}

const COLOR_LABEL: Record<ProjectColor, string> = {
  red: "Kırmızı",
  orange: "Turuncu",
  yellow: "Sarı",
  green: "Yeşil",
  blue: "Mavi",
  purple: "Mor",
  pink: "Pembe",
  gray: "Gri",
}

export function ProjectsGrid() {
  const { projects, pinnedProjects } = useProjects()

  const sorted = [
    ...pinnedProjects,
    ...projects.filter((p) => !p.isPinned),
  ]

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FolderOpen className="size-4 text-muted-foreground" />
        <h2 className="text-base font-semibold">Projelerim</h2>
        <span className="flex items-center justify-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          {projects.length}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-12 rounded-2xl bg-card ring-1 ring-foreground/10 text-center">
          <FolderOpen className="size-9 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            Henüz proje yok — soldan yeni bir tane oluşturabilirsin.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {sorted.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.slug}`}
              className="group relative flex flex-col gap-4 rounded-2xl bg-card ring-1 ring-foreground/10 p-5 hover:-translate-y-0.5 hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex size-11 items-center justify-center rounded-xl text-2xl shrink-0",
                    COLOR_BG_SOFT[project.color]
                  )}
                >
                  {project.emoji}
                </div>
                {project.isPinned && (
                  <Pin className="size-3 text-muted-foreground/50 shrink-0 mt-0.5" />
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-sm font-semibold leading-tight truncate group-hover:text-primary transition-colors">
                  {project.name}
                </p>
                <span
                  className={cn(
                    "text-[11px] font-medium",
                    COLOR_TEXT[project.color]
                  )}
                >
                  {COLOR_LABEL[project.color]}
                </span>
              </div>

              <div className="flex items-center gap-1 text-xs text-muted-foreground group-hover:text-foreground transition-colors mt-auto">
                <span>Görüntüle</span>
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}