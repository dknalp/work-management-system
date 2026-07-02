"use client"

import React, { createContext, useCallback, useContext, useEffect, useState } from "react"
import { apiClient } from "@/lib/api"

export type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  phone?: string
  avatar?: string
  status: "active" | "away" | "offline"
  joinedAt: string
}

type ApiMember = {
  id: string
  name: string
  email: string
  role: string
  status?: string | null
  avatar?: string | null
  joined_at?: string | null
  phone?: string | null
}

function fromApi(m: ApiMember): TeamMember {
  return {
    id: m.id,
    name: m.name,
    email: m.email,
    role: m.role,
    status: (m.status as TeamMember["status"]) ?? "active",
    avatar: m.avatar ?? undefined,
    joinedAt: m.joined_at ?? new Date().toISOString(),
    phone: m.phone ?? undefined,
  }
}

interface TeamContextValue {
  members: TeamMember[]
  loading: boolean
  addMember: (member: TeamMember) => Promise<void>
  updateMember: (id: string, updates: Partial<TeamMember>) => Promise<void>
  deleteMember: (id: string) => Promise<void>
  refreshMembers: () => void
}

const TeamContext = createContext<TeamContextValue | null>(null)

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)

  const fetchMembers = useCallback(async () => {
    try {
      const data = await apiClient<ApiMember[]>("/api/v1/team/members")
      setMembers(data.map(fromApi))
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

  const addMember = useCallback(
    async (member: TeamMember) => {
      const created = await apiClient<ApiMember>("/api/v1/team/members", {
        method: "POST",
        body: JSON.stringify({
          id: member.id || undefined,
          name: member.name,
          email: member.email,
          role: member.role,
          phone: member.phone ?? null,
          avatar: member.avatar ?? null,
          status: member.status,
          joined_at: member.joinedAt || undefined,
        }),
      })
      setMembers((prev) => [...prev, fromApi(created)])
    },
    []
  )

  const updateMember = useCallback(
    async (id: string, updates: Partial<TeamMember>) => {
      setMembers((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      )
      try {
        const apiUpdates: Record<string, unknown> = {}
        if (updates.name !== undefined) apiUpdates.name = updates.name
        if (updates.email !== undefined) apiUpdates.email = updates.email
        if (updates.role !== undefined) apiUpdates.role = updates.role
        if (updates.phone !== undefined) apiUpdates.phone = updates.phone ?? null
        if (updates.avatar !== undefined) apiUpdates.avatar = updates.avatar ?? null
        if (updates.status !== undefined) apiUpdates.status = updates.status
        await apiClient<ApiMember>(`/api/v1/team/members/${id}`, {
          method: "PUT",
          body: JSON.stringify(apiUpdates),
        })
      } catch {
        fetchMembers()
      }
    },
    [fetchMembers]
  )

  const deleteMember = useCallback(
    async (id: string) => {
      setMembers((prev) => prev.filter((m) => m.id !== id))
      try {
        await apiClient(`/api/v1/team/members/${id}`, { method: "DELETE" })
      } catch {
        fetchMembers()
      }
    },
    [fetchMembers]
  )

  return (
    <TeamContext.Provider
      value={{
        members,
        loading,
        addMember,
        updateMember,
        deleteMember,
        refreshMembers: fetchMembers,
      }}
    >
      {children}
    </TeamContext.Provider>
  )
}

export function useTeam() {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error("useTeam must be used inside TeamProvider")
  return ctx
}
