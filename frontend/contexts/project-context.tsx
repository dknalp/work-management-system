"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { Project, ProjectColor } from "@/types/project"

const STORAGE_KEY = "wms:projects"

const SEED_PROJECTS: Project[] = [
  {
    id: "proj-1",
    name: "Web Uygulaması",
    slug: "web-uygulamasi",
    color: "blue",
    emoji: "🌐",
    isPinned: true,
    isExpanded: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "proj-2",
    name: "Mobil Uygulama",
    slug: "mobil-uygulama",
    color: "purple",
    emoji: "📱",
    isPinned: false,
    isExpanded: false,
    createdAt: new Date().toISOString(),
  },
]

interface ProjectContextValue {
  projects: Project[]
  searchQuery: string
  setSearchQuery: (q: string) => void
  createProject: (name: string, emoji: string, color: ProjectColor) => Project
  deleteProject: (id: string) => void
  renameProject: (id: string, name: string) => void
  togglePin: (id: string) => void
  toggleExpand: (id: string) => void
  pinnedProjects: Project[]
  unpinnedProjects: Project[]
  filteredProjects: Project[]
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

function ensureUniqueSlug(slug: string, existing: Project[]): string {
  const taken = new Set(existing.map((p) => p.slug))
  if (!taken.has(slug)) return slug
  let i = 2
  while (taken.has(`${slug}-${i}`)) i++
  return `${slug}-${i}`
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<Project[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        setProjects(JSON.parse(raw))
      } else {
        setProjects(SEED_PROJECTS)
      }
    } catch {
      setProjects(SEED_PROJECTS)
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
  }, [projects, hydrated])

  const projectsRef = React.useRef<Project[]>(projects)
  React.useEffect(() => { projectsRef.current = projects }, [projects])

  const createProject = useCallback(
    (name: string, emoji: string, color: ProjectColor): Project => {
      const slug = ensureUniqueSlug(slugify(name) || "proje", projectsRef.current)
      const project: Project = {
        id: `proj-${Date.now()}`,
        name: name.trim(),
        slug,
        color,
        emoji,
        isPinned: false,
        isExpanded: false,
        createdAt: new Date().toISOString(),
      }
      setProjects((prev) => [...prev, project])
      return project
    },
    []
  )

  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name.trim() } : p))
    )
  }, [])

  const togglePin = useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isPinned: !p.isPinned } : p))
    )
  }, [])

  const toggleExpand = useCallback((id: string) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, isExpanded: !p.isExpanded } : p))
    )
  }, [])

  const filteredProjects = searchQuery.trim()
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : projects

  const pinnedProjects = filteredProjects.filter((p) => p.isPinned)
  const unpinnedProjects = filteredProjects.filter((p) => !p.isPinned)

  return (
    <ProjectContext.Provider
      value={{
        projects,
        searchQuery,
        setSearchQuery,
        createProject,
        deleteProject,
        renameProject,
        togglePin,
        toggleExpand,
        pinnedProjects,
        unpinnedProjects,
        filteredProjects,
      }}
    >
      {children}
    </ProjectContext.Provider>
  )
}

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext)
  if (!ctx) throw new Error("useProjects must be used within ProjectProvider")
  return ctx
}