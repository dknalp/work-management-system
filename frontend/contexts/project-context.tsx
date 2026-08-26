"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { Project, ProjectColor } from "@/types/project"
import { apiClient } from "@/lib/api"
import { cacheGet, cacheSet } from "@/lib/query-cache"
import { useAuth } from "./auth-context"

type ApiProject = {
  id: string
  name: string
  slug: string
  color: string
  emoji: string
  is_pinned: boolean
  is_expanded: boolean
  created_at: string
}

function fromApi(p: ApiProject): Project {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    color: p.color as ProjectColor,
    emoji: p.emoji,
    isPinned: p.is_pinned,
    isExpanded: p.is_expanded,
    createdAt: p.created_at,
  }
}

interface ProjectContextValue {
  projects: Project[]
  loading: boolean
  searchQuery: string
  setSearchQuery: (q: string) => void
  createProject: (name: string, emoji: string, color: ProjectColor) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  renameProject: (id: string, name: string) => Promise<void>
  togglePin: (id: string) => Promise<void>
  toggleExpand: (id: string) => Promise<void>
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

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth()
  const [projects, setProjects] = useState<Project[]>(
    () => cacheGet<Project[]>("projects") ?? []
  )
  const [loading, setLoading] = useState(() => cacheGet<Project[]>("projects") === null)
  const [searchQuery, setSearchQuery] = useState("")

  const fetchProjects = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await apiClient<ApiProject[]>("/projects")
      const projects = data.map(fromApi)
      setProjects(projects)
      cacheSet("projects", projects)
    } catch {
      // keep previous state on error
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  // Wait for Firebase auth to resolve before fetching — avoids a 401 race
  // where the token is not yet stored when the context first mounts.
  useEffect(() => {
    if (authLoading) return
    const hasCached = cacheGet<Project[]>("projects") !== null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProjects(hasCached)
  }, [authLoading, fetchProjects])

  const createProject = useCallback(async (name: string, emoji: string, color: ProjectColor): Promise<Project> => {
    const slug = slugify(name) || "proje"
    const created = await apiClient<ApiProject>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, emoji, color, slug }),
    })
    const project = fromApi(created)
    setProjects((prev) => [...prev, project])
    return project
  }, [])

  const deleteProject = useCallback(async (id: string) => {
    await apiClient(`/projects/${id}`, { method: "DELETE" })
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const renameProject = useCallback(async (id: string, name: string) => {
    const slug = slugify(name) || "proje"
    const updated = await apiClient<ApiProject>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name, slug }),
    })
    setProjects((prev) => prev.map((p) => (p.id === id ? fromApi(updated) : p)))
  }, [])

  const togglePin = useCallback(async (id: string) => {
    const project = projects.find((p) => p.id === id)
    if (!project) return
    const updated = await apiClient<ApiProject>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_pinned: !project.isPinned }),
    })
    setProjects((prev) => prev.map((p) => (p.id === id ? fromApi(updated) : p)))
  }, [projects])

  const toggleExpand = useCallback(async (id: string) => {
    const project = projects.find((p) => p.id === id)
    if (!project) return
    const updated = await apiClient<ApiProject>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify({ is_expanded: !project.isExpanded }),
    })
    setProjects((prev) => prev.map((p) => (p.id === id ? fromApi(updated) : p)))
  }, [projects])

  const filteredProjects = searchQuery
    ? projects.filter((p) => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : projects

  const pinnedProjects = filteredProjects.filter((p) => p.isPinned)
  const unpinnedProjects = filteredProjects.filter((p) => !p.isPinned)

  return (
    <ProjectContext.Provider
      value={{
        projects,
        loading,
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
