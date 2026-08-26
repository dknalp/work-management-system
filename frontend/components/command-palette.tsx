"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command"
import {
  LayoutDashboard,
  KanbanSquare,
  CheckSquare,
  CalendarDays,
  Users,
  FolderOpen,
  CheckCircle2,
  Clock,
  CircleDot,
} from "lucide-react"
import { useTasks } from "@/contexts/task-context"

const NAV_ITEMS = [
  { label: "Ana Sayfa", href: "/home", icon: LayoutDashboard },
  { label: "Analitik", href: "/analytics", icon: LayoutDashboard },
  { label: "Kanban Panosu", href: "/board", icon: KanbanSquare },
  { label: "Görevler", href: "/tasks", icon: CheckSquare },
  { label: "Takvim", href: "/calendar", icon: CalendarDays },
  { label: "Ekip", href: "/team", icon: Users },
  { label: "Dosyalar", href: "/files", icon: FolderOpen },
]

const STATUS_ICON: Record<string, React.ElementType> = {
  done: CheckCircle2,
  "in-progress": Clock,
  todo: CircleDot,
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const { tasks } = useTasks()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const go = useCallback(
    (href: string) => {
      setOpen(false)
      router.push(href)
    },
    [router]
  )

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages and tasks..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            return (
              <CommandItem key={item.href} onSelect={() => go(item.href)}>
                <Icon className="mr-2 size-4 text-muted-foreground" />
                {item.label}
              </CommandItem>
            )
          })}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Tasks">
          {tasks.slice(0, 50).map((task) => {
            const Icon = STATUS_ICON[task.status] ?? CircleDot
            return (
              <CommandItem
                key={task.id}
                value={`${task.title} ${(task.assignees ?? []).join(" ")} ${task.status}`}
                onSelect={() => go("/tasks")}
              >
                <Icon className="mr-2 size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{task.title}</span>
                {(task.assignees ?? []).length > 0 && (
                  <span className="ml-2 text-xs text-muted-foreground">{(task.assignees ?? []).join(", ")}</span>
                )}
              </CommandItem>
            )
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}