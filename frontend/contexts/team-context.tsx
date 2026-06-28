"use client"

import React, { createContext, useContext, useCallback, useEffect, useState } from "react"
import { apiClient } from "@/lib/api"

export type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  status: "active" | "away" | "offline"
  avatar?: string
  joinedAt: string
  phone?: string
}

type ApiMember = {
  id: string
  name: string
  email: string
  role: string
  status: string
  avatar?: string | null
  joined_at: string
  phone?: string | null
}

function fromApi(m: ApiMember): TeamMember {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: m.status as TeamMember["status"],
    avatar: m.avatar ?? undefined,
    joinedAt: m.joined_at,
    phone: m.phone ?? undefined,
  }
}

interface TeamContextValue {
  members: TeamMember[]
  loading: boolean
  addMember: (member: TeamMember) => Promise<void>
  updateMember: (id: string, updates: Partial<TeamMember>) => Promise<void>
  deleteMember: (id: string) => Promise<void>
}

const TeamContext = createContext<TeamContextValue | null>(null)

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    try {
      const data = await apiClient<ApiMember[]>("/team")
      setMembers(data.map(fromApi))
    } catch {
      // keep previous state
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const addMember = useCallback(async (member: TeamMember) => {
    try {
      const created = await apiClient<ApiMember>("/team", {
        method: "POST",
        body: JSON.stringify({
          id: member.id,
          name: member.name,
          email: member.email,
          role: member.role,
          status: member.status,
          avatar: member.avatar ?? null,
          joined_at: member.joinedAt,
          phone: member.phone ?? null,
        }),
      })
      setMembers((prev) => [fromApi(created), ...prev])
    } catch {
      fetchMembers()
      throw new Error("Üye eklenemedi")
    }
  }, [fetchMembers])

  const updateMember = useCallback(async (id: string, updates: Partial<TeamMember>) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, ...updates } : m)))
    try {
      const apiUpdates: Record<string, unknown> = {}
      if (updates.name !== undefined) apiUpdates.name = updates.name
      if (updates.email !== undefined) apiUpdates.email = updates.email
      if (updates.role !== undefined) apiUpdates.role = updates.role
      if (updates.status !== undefined) apiUpdates.status = updates.status
      if (updates.avatar !== undefined) apiUpdates.avatar = updates.avatar ?? null
      if (updates.phone !== undefined) apiUpdates.phone = updates.phone ?? null

      await apiClient(`/team/${id}`, {
        method: "PUT",
        body: JSON.stringify(apiUpdates),
      })
    } catch {
      fetchMembers()
      throw new Error("Üye güncellenemedi")
    }
  }, [fetchMembers])

  const deleteMember = useCallback(async (id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id))
    try {
      await apiClient(`/team/${id}`, { method: "DELETE" })
    } catch {
      fetchMembers()
      throw new Error("Üye silinemedi")
    }
  }, [fetchMembers])

  return (
    <TeamContext.Provider value={{ members, loading, addMember, updateMember, deleteMember }}>
      {children}
    </TeamContext.Provider>
  )
}

export function useTeam() {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error("useTeam must be used inside TeamProvider")
  return ctx
}