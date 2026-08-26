"use client"

import React from "react"
import { AppShellDynamic } from "@/components/layout/app-shell-dynamic"
import { PipelinesList } from "@/components/pipelines/pipelines-list"

export default function PipelinesPage() {
  return (
    <AppShellDynamic>
        <main className="flex flex-1 flex-col overflow-auto bg-background">
          <div className="mx-auto w-full max-w-6xl px-6 py-8">
            <PipelinesList showProjectBadge={true} />
          </div>
        </main>
      </AppShellDynamic>
  )
}