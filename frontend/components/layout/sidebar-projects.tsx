"use client"

import React, { useState, useRef, useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  PlusIcon,
  SearchIcon,
  PinIcon,
  PinOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
  Trash2Icon,
  LayoutDashboardIcon,
  KanbanIcon,
  FolderIcon,
  CheckSquareIcon,
  ChevronRightIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useProjects } from "@/contexts/project-context"
import { Project, ProjectColor, PROJECT_COLORS } from "@/types/project"
import { toast } from "sonner"

const COLOR_OPTIONS: { value: ProjectColor; label: string }[] = [
  { value: "blue", label: "Mavi" },
  { value: "purple", label: "Mor" },
  { value: "green", label: "Yeşil" },
  { value: "red", label: "Kırmızı" },
  { value: "orange", label: "Turuncu" },
  { value: "yellow", label: "Sarı" },
  { value: "pink", label: "Pembe" },
  { value: "gray", label: "Gri" },
]

const EMOJI_OPTIONS = ["🚀", "🌐", "📱", "💼", "🎯", "⚡", "🔥", "🌟", "🛠️", "📊"]

const SUB_VIEWS = [
  { key: "overview", label: "Genel Bakış", Icon: LayoutDashboardIcon },
  { key: "pipelines", label: "Pipeline'lar", Icon: KanbanIcon },
  { key: "tasks", label: "Görevler", Icon: CheckSquareIcon },
  { key: "folders", label: "Klasörler", Icon: FolderIcon },
] as const

function ProjectColorBadge({ project }: { project: Project }) {
  const colorClass = PROJECT_COLORS[project.color]
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium shrink-0 select-none size-5 text-[11px]",
        colorClass
      )}
    >
      {project.emoji}
    </span>
  )
}

function RenameInput({
  initialValue,
  onConfirm,
  onCancel,
}: {
  initialValue: string
  onConfirm: (v: string) => void
  onCancel: () => void
}) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  function submit() {
    const trimmed = value.trim()
    if (trimmed) onConfirm(trimmed)
    else onCancel()
  }

  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); submit() }
        if (e.key === "Escape") { e.preventDefault(); onCancel() }
        e.stopPropagation()
      }}
      onBlur={submit}
      onClick={(e) => e.stopPropagation()}
      className="flex-1 min-w-0 bg-transparent text-sm outline-none border-b border-sidebar-border py-0.5"
    />
  )
}

function CreateProjectInput({
  onConfirm,
  onCancel,
}: {
  onConfirm: (name: string, emoji: string, color: ProjectColor) => void
  onCancel: () => void
}) {
  const [name, setName] = useState("")
  const [emoji, setEmoji] = useState("🚀")
  const [color, setColor] = useState<ProjectColor>("blue")
  const [showPicker, setShowPicker] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => { ref.current?.focus() }, [])

  function submit() {
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed, emoji, color)
    else onCancel()
  }

  return (
    <div className="mx-2 my-1 rounded-md border border-sidebar-border bg-sidebar p-2 space-y-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className={cn(
            "size-6 rounded flex items-center justify-center text-sm shrink-0",
            PROJECT_COLORS[color]
          )}
        >
          {emoji}
        </button>
        <input
          ref={ref}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit()
            if (e.key === "Escape") onCancel()
          }}
          placeholder="Proje adı..."
          className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {showPicker && (
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1">
            {EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEmoji(e)}
                className={cn(
                  "size-6 rounded text-sm flex items-center justify-center hover:bg-sidebar-accent",
                  emoji === e && "ring-1 ring-sidebar-border"
                )}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setColor(c.value)}
                className={cn(
                  "size-4 rounded-full",
                  PROJECT_COLORS[c.value],
                  color === c.value && "ring-2 ring-offset-1 ring-sidebar-border"
                )}
              />
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1.5 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground px-2 py-0.5 rounded"
        >
          İptal
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={!name.trim()}
          className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded disabled:opacity-40"
        >
          Oluştur
        </button>
      </div>
    </div>
  )
}

function ProjectItem({ project }: { project: Project }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { togglePin, toggleExpand, deleteProject, renameProject } = useProjects()
  const [renaming, setRenaming] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = pathname.startsWith(`/projects/${project.slug}`)

  function handleRenameConfirm(v: string) {
    if (v !== project.name) renameProject(project.id, v)
    setRenaming(false)
  }

  function handleDelete() {
    deleteProject(project.id)
    toast.success(`"${project.name}" silindi`)
  }

  return (
    <SidebarMenuItem>
      <div
        className="flex items-center"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Expand chevron */}
        <button
          type="button"
          onClick={() => toggleExpand(project.id)}
          className="flex items-center justify-center w-4 h-6 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <ChevronRightIcon
            className={cn("size-3 transition-transform", project.isExpanded && "rotate-90")}
          />
        </button>

        {/* Name row — plain div when renaming, SidebarMenuButton when not */}
        {renaming ? (
          <div className="flex flex-1 min-w-0 items-center gap-1.5 px-1 py-1 h-7">
            <ProjectColorBadge project={project} />
            <RenameInput
              initialValue={project.name}
              onConfirm={handleRenameConfirm}
              onCancel={() => setRenaming(false)}
            />
          </div>
        ) : (
          <SidebarMenuButton
            asChild
            isActive={isActive}
            className="flex-1 min-w-0 gap-1.5 h-7"
          >
            <Link href={`/projects/${project.slug}`}>
              <ProjectColorBadge project={project} />
              <span className="truncate text-sm">{project.name}</span>
            </Link>
          </SidebarMenuButton>
        )}

        {/* Actions — visible on hover or while menu is open */}
        {(hovered || menuOpen) && !renaming && (
          <div className="flex items-center gap-0.5 pr-1 shrink-0">
            <button
              type="button"
              onClick={() => togglePin(project.id)}
              title={project.isPinned ? "Sabitlemeyi kaldır" : "Sabitle"}
              className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            >
              {project.isPinned ? <PinOffIcon className="size-3" /> : <PinIcon className="size-3" />}
            </button>

            <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="size-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
                >
                  <MoreHorizontalIcon className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-44">
                <DropdownMenuItem onClick={() => setRenaming(true)}>
                  <PencilIcon className="size-3.5 mr-2" />
                  Yeniden Adlandır
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => togglePin(project.id)}>
                  {project.isPinned ? (
                    <><PinOffIcon className="size-3.5 mr-2" />Sabitlemeyi Kaldır</>
                  ) : (
                    <><PinIcon className="size-3.5 mr-2" />Sabitle</>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2Icon className="size-3.5 mr-2" />
                  Sil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Sub-views when expanded */}
      {project.isExpanded && (
        <SidebarMenuSub>
          {SUB_VIEWS.map(({ key, label, Icon }) => {
            const href = `/projects/${project.slug}?view=${key}`
            const currentView = searchParams.get("view") || "overview"
            const isSubActive = pathname === `/projects/${project.slug}` && currentView === key
            return (
              <SidebarMenuSubItem key={key}>
                <SidebarMenuSubButton
                  asChild
                  isActive={isSubActive}
                  className="h-6 text-xs gap-1.5"
                >
                  <Link href={href}>
                    <Icon className="size-3 shrink-0" />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSub>
      )}
    </SidebarMenuItem>
  )
}

export function SidebarProjects() {
  const {
    pinnedProjects,
    unpinnedProjects,
    searchQuery,
    setSearchQuery,
    createProject,
    filteredProjects,
  } = useProjects()

  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
    else setSearchQuery("")
  }, [searchOpen, setSearchQuery])

  function handleCreate(name: string, emoji: string, color: ProjectColor) {
    const project = createProject(name, emoji, color)
    setCreateOpen(false)
    toast.success(`"${project.name}" projesi oluşturuldu`)
  }

  return (
    <SidebarGroup className="py-0">
      <SidebarGroupLabel className="flex items-center justify-between px-2 h-8 text-xs font-medium tracking-wider uppercase text-muted-foreground">
        <span>Projeler</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => { setSearchOpen((v) => !v); setCreateOpen(false) }}
            title="Proje ara"
            className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
          >
            <SearchIcon className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => { setCreateOpen((v) => !v); setSearchOpen(false) }}
            title="Yeni proje"
            className="size-5 flex items-center justify-center rounded hover:bg-sidebar-accent text-muted-foreground hover:text-foreground"
          >
            <PlusIcon className="size-3" />
          </button>
        </div>
      </SidebarGroupLabel>

      <SidebarGroupContent>
        {searchOpen && (
          <div className="px-2 pb-1">
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setSearchOpen(false)}
              placeholder="Proje ara..."
              className="w-full h-7 rounded-md border border-sidebar-border bg-sidebar px-2 text-xs outline-none placeholder:text-muted-foreground focus:border-ring"
            />
          </div>
        )}

        {createOpen && (
          <CreateProjectInput
            onConfirm={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        )}

        <SidebarMenu>
          {filteredProjects.length === 0 && (
            <div className="px-4 py-2 text-xs text-muted-foreground">
              {searchQuery ? "Proje bulunamadı" : "Henüz proje yok"}
            </div>
          )}

          {pinnedProjects.length > 0 && (
            <>
              <div className="px-2 pt-1 pb-0.5 flex items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Sabitlenmiş
                </span>
                <div className="flex-1 h-px bg-sidebar-border/60" />
              </div>
              {pinnedProjects.map((project) => (
                <ProjectItem key={project.id} project={project} />
              ))}
            </>
          )}

          {unpinnedProjects.length > 0 && (
            <>
              {pinnedProjects.length > 0 && (
                <div className="px-2 pt-2 pb-0.5 flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                    Projeler
                  </span>
                  <div className="flex-1 h-px bg-sidebar-border/60" />
                </div>
              )}
              {unpinnedProjects.map((project) => (
                <ProjectItem key={project.id} project={project} />
              ))}
            </>
          )}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}