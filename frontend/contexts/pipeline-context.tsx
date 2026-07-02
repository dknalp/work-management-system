"use client"

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { Pipeline } from "@/types/pipeline"

const STORAGE_KEY = "wms:pipelines"

interface PipelineContextValue {
  pipelines: Pipeline[]
  createPipeline: (projectId: string, name: string) => Pipeline
  deletePipeline: (id: string) => void
  renamePipeline: (id: string, name: string) => void
  getPipelinesByProject: (projectId: string) => Pipeline[]
  getPipelineById: (id: string) => Pipeline | undefined
}

const PipelineContext = createContext<PipelineContextValue | null>(null)

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [hydrated, setHydrated] = useState(false)
  const pipelinesRef = useRef<Pipeline[]>([])

  useEffect(() => {
    pipelinesRef.current = pipelines
  }, [pipelines])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setPipelines(JSON.parse(raw))
    } catch { /* ignore */ }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pipelines))
  }, [pipelines, hydrated])

  const createPipeline = useCallback((projectId: string, name: string): Pipeline => {
    const pipeline: Pipeline = {
      id: `pl-${Date.now()}`,
      projectId,
      name: name.trim(),
      createdAt: new Date().toISOString(),
    }
    setPipelines((prev) => [...prev, pipeline])
    return pipeline
  }, [])

  const deletePipeline = useCallback((id: string) => {
    setPipelines((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const renamePipeline = useCallback((id: string, name: string) => {
    setPipelines((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name.trim() } : p))
    )
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
