"use client"

import React, { createContext, useContext, useState, useCallback } from "react"

export type TeamMember = {
  id: string
  name: string
  email: string
  role: string
  department: string
  status: "active" | "away" | "offline"
  avatar?: string
  joinedAt: string
  phone?: string
}

const SEED_MEMBERS: TeamMember[] = [
  { id: "tm-1", name: "Alex Johnson", email: "alex@company.com", role: "Frontend Lead", department: "Engineering", status: "active", joinedAt: "2023-01-15" },
  { id: "tm-2", name: "Sarah Chen", email: "sarah@company.com", role: "Backend Engineer", department: "Engineering", status: "active", joinedAt: "2023-03-01" },
  { id: "tm-3", name: "Marcus Webb", email: "marcus@company.com", role: "DevOps Engineer", department: "Infrastructure", status: "away", joinedAt: "2023-02-10" },
  { id: "tm-4", name: "Priya Nair", email: "priya@company.com", role: "Database Admin", department: "Engineering", status: "active", joinedAt: "2023-04-05" },
  { id: "tm-5", name: "Jordan Kim", email: "jordan@company.com", role: "Product Manager", department: "Product", status: "active", joinedAt: "2022-11-20" },
  { id: "tm-6", name: "Emily Torres", email: "emily@company.com", role: "UX Designer", department: "Design", status: "active", joinedAt: "2023-05-15" },
  { id: "tm-7", name: "Liam Patel", email: "liam@company.com", role: "QA Engineer", department: "Engineering", status: "offline", joinedAt: "2023-06-01" },
  { id: "tm-8", name: "Aisha Okonkwo", email: "aisha@company.com", role: "Data Analyst", department: "Analytics", status: "active", joinedAt: "2023-07-10" },
  { id: "tm-9", name: "Chris Nakamura", email: "chris@company.com", role: "Security Engineer", department: "Infrastructure", status: "active", joinedAt: "2022-09-01" },
  { id: "tm-10", name: "Fatima Hassan", email: "fatima@company.com", role: "Mobile Developer", department: "Engineering", status: "away", joinedAt: "2023-08-20" },
  { id: "tm-11", name: "Ryan O'Brien", email: "ryan@company.com", role: "Tech Lead", department: "Engineering", status: "active", joinedAt: "2022-06-15" },
  { id: "tm-12", name: "Nadia Volkov", email: "nadia@company.com", role: "Scrum Master", department: "Product", status: "active", joinedAt: "2023-01-30" },
]

interface TeamContextValue {
  members: TeamMember[]
  addMember: (member: TeamMember) => void
  updateMember: (id: string, updates: Partial<TeamMember>) => void
  deleteMember: (id: string) => void
}

const TeamContext = createContext<TeamContextValue | null>(null)

export function TeamProvider({ children }: { children: React.ReactNode }) {
  const [members, setMembers] = useState<TeamMember[]>(SEED_MEMBERS)

  const addMember = useCallback((member: TeamMember) => {
    setMembers((prev) => [member, ...prev])
  }, [])

  const updateMember = useCallback((id: string, updates: Partial<TeamMember>) => {
    setMembers((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
    )
  }, [])

  const deleteMember = useCallback((id: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }, [])

  return (
    <TeamContext.Provider value={{ members, addMember, updateMember, deleteMember }}>
      {children}
    </TeamContext.Provider>
  )
}

export function useTeam() {
  const ctx = useContext(TeamContext)
  if (!ctx) throw new Error("useTeam must be used inside TeamProvider")
  return ctx
}
