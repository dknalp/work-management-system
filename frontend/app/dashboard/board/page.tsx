"use client"

import React, { useState, useRef, useCallback } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SiteHeader } from "@/components/layout/site-header"
import { KanbanBoard } from "@/components/dashboard/board/kanban-board"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { PlusIcon, Settings2Icon, Share2Icon } from "lucide-react"
import { usePermission } from "@/hooks/use-permission"
import { AccessDenied } from "@/components/auth/access-denied"

export default function BoardPage() {
  const canViewBoard = usePermission("board:view")
  const canEditBoard = usePermission("board:edit")
  const [addColumnOpen, setAddColumnOpen] = useState(false)
  const [columnTitle, setColumnTitle] = useState("")
  const addColumnFnRef = useRef<((title: string) => void) | null>(null)

  const handleAddColumnReady = useCallback((fn: (title: string) => void) => {
    addColumnFnRef.current = fn
  }, [])

  function openAddColumn() {
    setColumnTitle("")
    setAddColumnOpen(true)
  }

  function confirmAddColumn() {
    const trimmed = columnTitle.trim()
    if (!trimmed) return
    addColumnFnRef.current?.(trimmed)
    setAddColumnOpen(false)
    setColumnTitle("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") confirmAddColumn()
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 64)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader />
        <main className="flex flex-1 flex-col overflow-hidden bg-background">
          {!canViewBoard ? (
            <AccessDenied />
          ) : (
            <>
              {/* Sub Header / Toolbox */}
              <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
                <div className="space-y-0.5">
                  <h2 className="text-xl font-bold tracking-tight">
                    Pipeline Panosu
                  </h2>
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    Ekibinizin iş akışını yönetin ve ilerlemeyi takip edin.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="h-8 gap-2">
                    <Share2Icon className="size-3.5" />
                    Paylaş
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 gap-2">
                    <Settings2Icon className="size-3.5" />
                    Özelleştir
                  </Button>
                  {canEditBoard && (
                    <>
                      <div className="mx-1 h-4 w-px bg-border" />
                      <Button size="sm" className="h-8 gap-2" onClick={openAddColumn}>
                        <PlusIcon className="size-3.5" />
                        Sütun Ekle
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-hidden p-6">
                <KanbanBoard onAddColumn={handleAddColumnReady} />
              </div>
            </>
          )}
        </main>
      </SidebarInset>

      {/* Add Column Dialog */}
      <Dialog open={addColumnOpen} onOpenChange={setAddColumnOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Sütun Ekle
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-1.5 py-2">
            <Label
              htmlFor="column-title"
              className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              Sütun adı
            </Label>
            <input
              id="column-title"
              type="text"
              value={columnTitle}
              onChange={(e) => setColumnTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="örn. İnceleme, Engellendi, QA…"
              autoFocus
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddColumnOpen(false)}
            >
              İptal
            </Button>
            <Button
              size="sm"
              onClick={confirmAddColumn}
              disabled={!columnTitle.trim()}
            >
              Sütun Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  )
}
