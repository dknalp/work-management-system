"use client"

import React from "react"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { KanbanBoard } from "@/components/dashboard/board/kanban-board"

export default function BoardPage() {
  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <KanbanBoard />
        </main>
      </AppShellDynamic>
  )
}
