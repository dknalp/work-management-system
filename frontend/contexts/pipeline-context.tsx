"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { Pipeline } from "@/types/pipeline"
import { apiClient } from "@/lib/api"
import { cacheGet, cacheSet } from "@/lib/query-cache"
import { useAuth } from "./auth-context"

type ApiPipeline = {
  id: string
  project_id: string
  name: string
  created_at: string
}

function fromApi(p: ApiPipeline): Pipeline {
  return {
    id: p.id,
    projectId: p.project_id,
    name: p.name,
    createdAt: p.created_at,
  }
}

interface PipelineContextValue {
  pipelines: Pipeline[]
  loading: boolean
  createPipeline: (projectId: string, name: string) => Promise<Pipeline>
  deletePipeline: (id: string) => Promise<void>
  renamePipeline: (id: string, name: string) => Promise<void>
  getPipelinesByProject: (projectId: string) => Pipeline[]
  getPipelineById: (id: string) => Pipeline | undefined
}

const PipelineContext = createContext<PipelineContextValue | null>(null)

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const { loading: authLoading } = useAuth()
  const [pipelines, setPipelines] = useState<Pipeline[]>(
    () => cacheGet<Pipeline[]>("pipelines") ?? []
  )
  const [loading, setLoading] = useState(() => cacheGet<Pipeline[]>("pipelines") === null)
  const pipelinesRef = useRef<Pipeline[]>([])

  useEffect(() => {
    pipelinesRef.current = pipelines
  }, [pipelines])

  const fetchPipelines = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const data = await apiClient<ApiPipeline[]>("/pipelines")
      const pipelines = data.map(fromApi)
      setPipelines(pipelines)
      cacheSet("pipelines", pipelines)
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
    const hasCached = cacheGet<Pipeline[]>("pipelines") !== null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPipelines(hasCached)
  }, [authLoading, fetchPipelines])

  const createPipeline = useCallback(async (projectId: string, name: string): Promise<Pipeline> => {
    const created = await apiClient<ApiPipeline>("/pipelines", {
      method: "POST",
      body: JSON.stringify({ project_id: projectId, name: name.trim() }),
    })
    const pipeline = fromApi(created)
    setPipelines((prev) => [...prev, pipeline])
    return pipeline
  }, [])

  const deletePipeline = useCallback(async (id: string) => {
    await apiClient(`/pipelines/${id}`, { method: "DELETE" })
    setPipelines((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const renamePipeline = useCallback(async (id: string, name: string) => {
    const updated = await apiClient<ApiPipeline>(`/pipelines/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name: name.trim() }),
    })
    setPipelines((prev) => prev.map((p) => (p.id === id ? fromApi(updated) : p)))
  }, [])

  const getPipelinesByProject = useCallback((projectId: string): Pipeline[] => {
    return pipelinesRef.current.filter((p) => p.projectId === projectId)
  }, [])

  const getPipelineById = useCallback((id: string): Pipeline | undefined => {
    return pipelinesRef.current.find((p) => p.id === id)
  }, [])

  return (
    <PipelineContext.Provider
      value={{
        pipelines,
        loading,
        createPipeline,
        deletePipeline,
        renamePipeline,
        getPipelinesByProject,
        getPipelineById,
      }}
    >
      {children}
    </PipelineContext.Provider>
  )
}

export function usePipelines(): PipelineContextValue {
  const ctx = useContext(PipelineContext)
  if (!ctx) throw new Error("usePipelines must be used within PipelineProvider")
  return ctx
}
