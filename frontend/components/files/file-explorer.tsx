"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Share2Icon,
  FolderIcon,
  MoreVerticalIcon,
  PencilIcon,
  PinIcon,
  StarIcon,
  Trash2Icon,
  ExternalLinkIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  MoveIcon,
  XIcon,
  CopyIcon,
  ScissorsIcon,
  ClipboardPasteIcon,
  SlidersHorizontalIcon,
  PaletteIcon,
  SearchIcon,
  FileIcon,
  ImageIcon,
  VideoIcon,
  Music2Icon,
  FileTextIcon,
  FileSpreadsheetIcon,
  PresentationIcon,
  ArchiveIcon,
  CodeIcon,
} from "lucide-react"
import { format } from "date-fns"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { SearchFilterPanel } from "@/components/files/search-filter-panel"
import { FolderCustomizeDialog } from "@/components/files/folder-customize-dialog"
import { searchFiles, customizeFile, type SearchFilters } from "@/lib/actions/files"
import { cn } from "@/lib/utils"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { FileGrid } from "./file-grid"
import { FilePreviewPanel } from "./file-preview-panel"
import { FileToolbar } from "./file-toolbar"
import { FileDropZone } from "./file-drop-zone"
import { SelectionLasso } from "./selection-lasso"
import { SearchResultsView } from "./search-results-view"
import { getFileIcon, formatSize, getFileOpenUrl, downloadFile, isImageFile } from "./file-utils"
import type { FileItem, SearchResult } from "./file-utils"
import { toast } from "sonner"
import { usePermission } from "@/hooks/use-permission"
import { usePinnedFolders } from "@/hooks/use-pinned-folders"
import { UploadQueueProvider } from "@/components/files/upload-queue"
import {
  trashFile,
  moveFile,
  renameFile,
  copyFile,
  starFile,
} from "@/lib/actions/files"
import { ShareDialog } from "./share-dialog"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core"
import type { DragStartEvent, DragEndEvent } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"

// ---------------------------------------------------------------------------
// FileThumbnail — resimler için lazy thumbnail, diğerleri için ikon
// ---------------------------------------------------------------------------

const TYPE_ICON_MAP: Record<string, React.ReactNode> = {
  folder: <FolderIcon className="size-5 text-amber-400" />,
  image: <ImageIcon className="size-5 text-blue-400" />,
  video: <VideoIcon className="size-5 text-purple-400" />,
  audio: <Music2Icon className="size-5 text-pink-400" />,
  pdf: <FileTextIcon className="size-5 text-red-400" />,
  word: <FileTextIcon className="size-5 text-blue-500" />,
  excel: <FileSpreadsheetIcon className="size-5 text-green-500" />,
  powerpoint: <PresentationIcon className="size-5 text-orange-400" />,
  archive: <ArchiveIcon className="size-5 text-yellow-500" />,
  code: <CodeIcon className="size-5 text-emerald-400" />,
  markdown: <FileTextIcon className="size-5 text-slate-400" />,
  text: <FileTextIcon className="size-5 text-muted-foreground" />,
  file: <FileIcon className="size-5 text-muted-foreground" />,
}

const TYPE_LABEL_MAP: Record<string, string> = {
  folder: "Klasör",
  image: "Görsel",
  video: "Video",
  audio: "Ses",
  pdf: "PDF",
  word: "Word",
  excel: "Excel",
  powerpoint: "PowerPoint",
  archive: "Arşiv",
  code: "Kod",
  markdown: "Markdown",
  text: "Metin",
  file: "Dosya",
}

function FileThumbnail({ item }: { item: FileItem }) {
  const [thumbUrl, setThumbUrl] = React.useState<string | null>(null)
  const [failed, setFailed] = React.useState(false)
  const isImage = isImageFile(item)
  const { listeners, attributes, setDragRef } = useDragHandle()

  React.useEffect(() => {
    if (!isImage) return
    let cancelled = false
    import("@/lib/actions/files").then(({ getPreviewUrl }) => {
      getPreviewUrl(item.id).then((url) => {
        if (!cancelled) setThumbUrl(url)
      }).catch(() => {
        if (!cancelled) setFailed(true)
      })
    })
    return () => { cancelled = true }
  }, [item.id, isImage])

  const dragProps = listeners && attributes && setDragRef
    ? {
        ...listeners,
        ...attributes,
        ref: setDragRef,
        "data-drag-handle": "true",
        style: { touchAction: "none" } as React.CSSProperties,
      }
    : {}

  if (isImage && thumbUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={thumbUrl}
        alt={item.name}
        className="size-8 rounded object-cover shrink-0 border border-border/40 cursor-grab active:cursor-grabbing"
        onError={() => setFailed(true)}
        {...dragProps}
      />
    )
  }

  const iconType = getFileIcon(item)
  return (
    <span
      className="size-8 flex items-center justify-center shrink-0 cursor-grab active:cursor-grabbing"
      {...dragProps}
    >
      {TYPE_ICON_MAP[iconType] ?? TYPE_ICON_MAP.file}
    </span>
  )
}

function FileTypeBadge({ item }: { item: FileItem }) {
  const iconType = getFileIcon(item)
  const label = TYPE_LABEL_MAP[iconType] ?? "Dosya"
  return (
    <span className="inline-flex items-center rounded-md border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      {label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// StarredStrip — yıldızlı dosyaları yatay şerit olarak gösterir
// ---------------------------------------------------------------------------

function StarredStrip({
  currentPath,
  onOpen,
}: {
  currentPath: string
  onOpen: (item: FileItem) => void
}) {
  const [starred, setStarred] = React.useState<FileItem[]>([])

  const loadStarred = React.useCallback(async () => {
    try {
      const { listStarred } = await import("@/lib/actions/files")
      const { fileRecordToItem: toItem } = await import("./file-utils")
      const records = await listStarred()
      setStarred(records.map(toItem))
    } catch { /* ignore */ }
  }, [])

  React.useEffect(() => {
    loadStarred()
  // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [loadStarred, currentPath])

  React.useEffect(() => {
    window.addEventListener("wms:files:changed", loadStarred)
    return () => window.removeEventListener("wms:files:changed", loadStarred)
  }, [loadStarred])

  if (starred.length === 0) return null

  return (
    <div className="border-b border-border px-6 py-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
        <StarIcon className="size-3 fill-yellow-400 text-yellow-400" />
        Yıldızlılar
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {starred.map((item) => (
          <button
            key={item.id}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs hover:bg-muted/80 transition-colors max-w-[180px]"
            onDoubleClick={() => onOpen(item)}
            onClick={() => onOpen(item)}
            title={item.path}
          >
            <span className="shrink-0">{TYPE_ICON_MAP[getFileIcon(item)] ?? TYPE_ICON_MAP.file}</span>
            <span className="truncate">{item.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

interface FileExplorerProps {
  items: FileItem[]
  currentPath: string
  sourceFilter?: "all" | "disk" | "drive"
  viewMode: "grid" | "list"
  showPreview: boolean
  onTogglePreview: () => void
  searchQuery: string
  searchResults?: SearchResult[] | null
  isSearching?: boolean
  onClearSearch?: () => void
}

type Clipboard = { paths: string[]; mode: "copy" | "cut" } | null

// ── DndTableRow ─────────────────────────────────────────────────────────────
// Drag handle context — lets child cells access the dnd listeners
type DragHandleCtx = {
  listeners?: ReturnType<typeof useDraggable>["listeners"]
  attributes?: ReturnType<typeof useDraggable>["attributes"]
  setDragRef?: (el: HTMLElement | null) => void
  isDragging?: boolean
}

const DragHandleContext = React.createContext<DragHandleCtx>({})

function useDragHandle() {
  return React.useContext(DragHandleContext)
}

function DndTableRow({
  item,
  children,
  className,
  onClick,
  onDoubleClick,
}: {
  item: FileItem
  children: React.ReactNode
  className?: string
  onClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void
  onDoubleClick?: (e: React.MouseEvent<HTMLTableRowElement>) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
    transform,
  } = useDraggable({
    id: `drag-${item.id}`,
    data: { item },
    disabled: item.name === ".." || Boolean(item.isDriveFile),
  })

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${item.id}`,
    data: { path: item.path, item },
    disabled: item.type !== "folder" || item.name === "..",
  })

  // Drop ref still on the row (for folder drop targets)
  const setRef = (el: HTMLTableRowElement | null) => {
    if (item.type === "folder" && item.name !== "..") setDropRef(el as unknown as HTMLElement)
  }

  const isDraggable = item.name !== ".." && !item.isDriveFile

  return (
    <DragHandleContext.Provider value={isDraggable ? { listeners, attributes, setDragRef, isDragging } : {}}>
      <TableRow
        ref={setRef}
        style={{ opacity: isDragging ? 0.4 : 1 }}
        className={cn(
          className,
          item.type === "folder" && isOver && "bg-primary/10 ring-1 ring-inset ring-primary/40",
          isDragging && "z-50 shadow-lg"
        )}
        data-file-path={item.path}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
      >
        {children}
      </TableRow>
    </DragHandleContext.Provider>
  )
}
// ────────────────────────────────────────────────────────────────────────────

export function FileExplorer({
  items: itemsProp,
  currentPath,
  sourceFilter = "all",
  viewMode,
  showPreview: _showPreview,
  searchQuery,
  searchResults,
  isSearching,
}: FileExplorerProps) {
  const router = useRouter()
  const canRename = usePermission("files:rename")
  const canDelete = usePermission("files:delete")
  const canMove = canDelete
  const containerRef = React.useRef<HTMLDivElement>(null)
  const { pin, isPinned } = usePinnedFolders()
  const [selectedPaths, setSelectedPaths] = React.useState<Set<string>>(new Set())
  const [activeItem, setActiveItem] = React.useState<FileItem | null>(null)

  const [clipboard, setClipboard] = React.useState<Clipboard>(null)

  const [renameOpen, setRenameOpen] = React.useState(false)
  const [renameTarget, setRenameTarget] = React.useState<FileItem | null>(null)
  const [renameValue, setRenameValue] = React.useState("")

  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deletePaths, setDeletePaths] = React.useState<string[]>([])

  const [moveToOpen, setMoveToOpen] = React.useState(false)
  const [moveSourcePaths, setMoveSourcePaths] = React.useState<string[]>([])
  const [moveToTarget, setMoveToTarget] = React.useState("")

  // Search & filter state (local, self-contained)
  const [localQuery, setLocalQuery] = React.useState("")
  const [localSearchResults, setLocalSearchResults] = React.useState<FileItem[] | null>(null)
  const [localSearching, setLocalSearching] = React.useState(false)
  const [searchFilters, setSearchFilters] = React.useState<SearchFilters>({})

  // Customize dialog state
  const [customizeDialogItem, setCustomizeDialogItem] = React.useState<FileItem | null>(null)

  // Share dialog state
  const [shareTarget, setShareTarget] = React.useState<FileItem | null>(null)

  // Local items state (for star toggle updates)
  const [localItems, setLocalItems] = React.useState<FileItem[]>(itemsProp ?? [])
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalItems(itemsProp ?? [])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsProp])
  const items = localItems

  const [sortKey, setSortKey] = useLocalStorage<"name" | "size" | "updatedAt">(
    "wms:files:sortKey",
    "name"
  )
  const [sortDir, setSortDir] = useLocalStorage<"asc" | "desc">("wms:files:sortDir", "asc")

  const [internalPreviewOpen, setInternalPreviewOpen] = React.useState(false)
  const [internalPreviewFile, setInternalPreviewFile] = React.useState<FileItem | null>(null)

  const handleItemDoubleClick = (item: FileItem) => {
    if (item.type === "folder") {
      const qs = sourceFilter !== "all" ? `?source=${sourceFilter}` : ""
      router.push(`/files/${item.path}${qs}`)
    } else {
      setInternalPreviewFile(item)
      setInternalPreviewOpen(true)
    }
  }

  const handleSingleItemDownload = React.useCallback(async (item: FileItem) => {
    if (item.type !== "folder") {
      downloadFile(item)
      return
    }
    // Folder download: request ZIP from backend
    try {
      const { downloadZip } = await import("@/lib/actions/files")
      await downloadZip([item.id], `${item.name}.zip`)
    } catch {
      toast.error("ZIP indirme başarısız oldu")
    }
  }, [])

  const handleRename = (item: FileItem) => {
    setRenameTarget(item)
    setRenameValue(item.name)
    setRenameOpen(true)
  }

  const doRename = async () => {
    if (!renameTarget || !renameValue.trim()) return
    try {
      await renameFile(renameTarget.id, renameValue.trim())
      toast.success("Yeniden adlandırıldı")
      setRenameOpen(false)
      window.dispatchEvent(new Event("wms:files:changed"))
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Yeniden adlandırma başarısız")
    }
  }

  const handleDeleteConfirm = (paths: string | string[]) => {
    setDeletePaths(typeof paths === "string" ? [paths] : paths)
    setDeleteOpen(true)
  }

  const doDelete = async () => {
    setDeleteOpen(false)
    // deletePaths holds file IDs in the new system
    const results = await Promise.allSettled(deletePaths.map((id) => trashFile(id)))
    const succeeded = results.filter((r) => r.status === "fulfilled")
    const failCount = results.length - succeeded.length

    if (succeeded.length > 0) {
      window.dispatchEvent(new Event("wms:files:changed"))
      setSelectedPaths(new Set())
      setActiveItem(null)

      toast.success(
        succeeded.length === 1
          ? `Öğe çöp kutusuna taşındı`
          : `${succeeded.length} öğe çöp kutusuna taşındı`,
        {
          duration: 6000,
          action: {
            label: "Geri Al",
            onClick: async () => {
              // Restore all succeeded items using their IDs
              const { restoreFile } = await import("@/lib/actions/files")
              await Promise.allSettled(
                results
                  .filter((r) => r.status === "fulfilled")
                  .map((r) => restoreFile((r as PromiseFulfilledResult<{ id: string }>).value.id))
              )
              window.dispatchEvent(new Event("wms:files:changed"))
              toast.success("Geri alındı")
            },
          },
        }
      )
    }
    if (failCount > 0) {
      toast.error(`${failCount} öğe taşınamadı`)
    }
  }

  const handleMoveToOpen = (paths: string[]) => {
    setMoveSourcePaths(paths)
    setMoveToTarget("")
    setMoveToOpen(true)
  }

  const doMoveTo = async () => {
    // moveSourcePaths holds file IDs
    const results = await Promise.allSettled(
      moveSourcePaths.map((id) => moveFile(id, moveToTarget))
    )
    const ok = results.filter((r) => r.status === "fulfilled").length
    if (ok > 0) {
      toast.success(`${ok} öğe taşındı`)
      setMoveToOpen(false)
      setSelectedPaths(new Set())
      window.dispatchEvent(new Event("wms:files:changed"))
    } else {
      toast.error("Taşıma başarısız")
    }
  }

  const handleBulkDownload = async () => {
    const selected = items.filter((i) => selectedPaths.has(i.path))
    const ids = selected.map((i) => i.id).filter(Boolean)
    if (ids.length === 0) return
    try {
      const { downloadZip } = await import("@/lib/actions/files")
      await downloadZip(ids, "secili-dosyalar.zip")
    } catch {
      toast.error("ZIP indirme başarısız oldu")
    }
  }

  const handleSort = (key: "name" | "size" | "updatedAt") => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const handleCopy = React.useCallback((paths: string[]) => {
    setClipboard({ paths, mode: "copy" })
    toast.success(
      paths.length === 1 ? "1 öğe kopyalandı" : `${paths.length} öğe kopyalandı`,
      { description: "Yapıştırmak için Ctrl+V" }
    )
  }, [])

  const handleCut = React.useCallback((paths: string[]) => {
    setClipboard({ paths, mode: "cut" })
    toast.success(
      paths.length === 1 ? "1 öğe kesildi" : `${paths.length} öğe kesildi`,
      { description: "Yapıştırmak için Ctrl+V" }
    )
  }, [])

  const handlePaste = React.useCallback(async () => {
    if (!clipboard) return
    // clipboard.paths holds file IDs
    const results = await Promise.allSettled(
      clipboard.paths.map((id) =>
        clipboard.mode === "copy"
          ? copyFile(id, currentPath)
          : moveFile(id, currentPath)
      )
    )
    const ok = results.filter((r) => r.status === "fulfilled").length
    if (ok > 0) {
      toast.success(clipboard.mode === "copy" ? `${ok} öğe yapıştırıldı` : `${ok} öğe taşındı`)
      if (clipboard.mode === "cut") setClipboard(null)
      window.dispatchEvent(new Event("wms:files:changed"))
    } else {
      toast.error("Yapıştırma başarısız")
    }
  }, [clipboard, currentPath, router])

  const handleLassoChange = React.useCallback(
    (rect: { top: number; left: number; width: number; height: number } | null) => {
      if (!rect) return
      const newSelected = new Set<string>()
      const container = containerRef.current
      if (!container) return

      container.querySelectorAll("[data-file-path]").forEach((el) => {
        const elRect = el.getBoundingClientRect()
        const containerRect = container.getBoundingClientRect()
        const rel = {
          top: elRect.top - containerRect.top + container.scrollTop,
          left: elRect.left - containerRect.left + container.scrollLeft,
          width: elRect.width,
          height: elRect.height,
        }
        const intersects =
          rect.left < rel.left + rel.width &&
          rect.left + rect.width > rel.left &&
          rect.top < rel.top + rel.height &&
          rect.top + rect.height > rel.top

        if (intersects) {
          const path = (el as HTMLElement).dataset.filePath
          if (path) newSelected.add(path)
        }
      })

      setSelectedPaths((prev) => {
        if (prev.size === newSelected.size && Array.from(newSelected).every((p) => prev.has(p)))
          return prev
        return newSelected
      })

      if (newSelected.size > 0) {
        const firstPath = Array.from(newSelected)[0]
        const firstItem = items.find((i) => i.path === firstPath)
        if (firstItem) setActiveItem((prev) => (prev?.path === firstItem.path ? prev : firstItem))
      }
    },
    [items]
  )

  const displayItems = React.useMemo(() => {
    const filtered = searchQuery
      ? items.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : [...items]

    filtered.sort((a, b) => {
      if (a.type === "folder" && b.type !== "folder") return -1
      if (a.type !== "folder" && b.type === "folder") return 1
      let cmp = 0
      if (sortKey === "name") cmp = a.name.localeCompare(b.name)
      else if (sortKey === "size") cmp = (a.size ?? 0) - (b.size ?? 0)
      else cmp = new Date(a.lastModified ?? 0).getTime() - new Date(b.lastModified ?? 0).getTime()
      return sortDir === "asc" ? cmp : -cmp
    })

    if (currentPath === "") return filtered

    const parentPath = currentPath.includes("/")
      ? currentPath.split("/").slice(0, -1).join("/")
      : ""
    return [
      {
        id: "",
        name: "..",
        path: parentPath,
        parent_path: "",
        type: "folder" as const,
        size: 0,
        lastModified: new Date().toISOString(),
      },
      ...filtered,
    ]
  }, [items, currentPath, searchQuery, sortKey, sortDir])

  const handleSelect = (item: FileItem, isMulti = false) => {
    if (item.name === "..") return
    if (isMulti) {
      const next = new Set(selectedPaths)
      if (next.has(item.path)) next.delete(item.path)
      else next.add(item.path)
      setSelectedPaths(next)
    } else {
      setSelectedPaths(new Set([item.path]))
    }
    setActiveItem(item)
  }

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (renameOpen || deleteOpen) return

      if (e.key === "Delete" && selectedPaths.size > 0 && canDelete) {
        const diskPaths = Array.from(selectedPaths).filter(
          (p) => !items.find((i) => i.path === p)?.isDriveFile
        )
        if (diskPaths.length > 0) handleDeleteConfirm(diskPaths)
      }
      if (e.key === "F2" && selectedPaths.size === 1 && activeItem && activeItem.name !== ".." && canRename && !activeItem.isDriveFile) {
        handleRename(activeItem)
      }
      if ((e.key === "a" || e.key === "A") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSelectedPaths(new Set(items.map((i) => i.path)))
        if (items.length > 0) setActiveItem(items[0])
      }
      if (canMove && (e.key === "c" || e.key === "C") && (e.ctrlKey || e.metaKey) && selectedPaths.size > 0) {
        e.preventDefault()
        handleCopy(Array.from(selectedPaths))
      }
      if (canMove && (e.key === "x" || e.key === "X") && (e.ctrlKey || e.metaKey) && selectedPaths.size > 0) {
        e.preventDefault()
        const diskPaths = Array.from(selectedPaths).filter(
          (p) => !items.find((i) => i.path === p)?.isDriveFile
        )
        if (diskPaths.length > 0) handleCut(diskPaths)
      }
      if (canMove && (e.key === "v" || e.key === "V") && (e.ctrlKey || e.metaKey) && clipboard) {
        e.preventDefault()
        handlePaste()
      }
      if (e.key === "Escape") {
        setSelectedPaths(new Set())
        setActiveItem(null)
        if (clipboard) setClipboard(null)
      }
      if (e.key === "Enter" && activeItem) {
        handleItemDoubleClick(activeItem)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPaths, activeItem, items, renameOpen, deleteOpen, clipboard, handleCopy, handleCut, handlePaste, canRename, canDelete])

  // Debounced local search with filters
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      const q = localQuery.trim()
      const hasFilters = Object.values(searchFilters).some((v) => v !== undefined && v !== null)
      if (!q && !hasFilters) {
        setLocalSearchResults(null)
        return
      }
      setLocalSearching(true)
      try {
        const records = await searchFiles(q, currentPath, searchFilters)
        setLocalSearchResults(records as unknown as FileItem[])
      } catch {
        setLocalSearchResults([])
      } finally {
        setLocalSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [localQuery, searchFilters, currentPath])

  // ── dnd-kit ──────────────────────────────────────────────────────────────
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [dndActiveItem, setDndActiveItem] = React.useState<FileItem | null>(null)

  const handleDndDragStart = React.useCallback((event: DragStartEvent) => {
    const item = (event.active.data.current as { item?: FileItem })?.item
    if (item) setDndActiveItem(item)
  }, [])

  const handleDndDragEnd = React.useCallback(async (event: DragEndEvent) => {
    setDndActiveItem(null)
    const { active, over } = event
    if (!over) return
    const draggedItem = (active.data.current as { item?: FileItem })?.item
    const overData = over.data.current as { path?: string; item?: FileItem } | undefined
    // targetItem is the folder we dropped onto
    const targetItem = overData?.item ?? displayItems.find(i => i.path === overData?.path)
    if (!draggedItem || !targetItem) return
    if (targetItem.type !== "folder") return
    if (draggedItem.path === targetItem.path) return
    // dest_parent = the folder's own path
    const destParent = targetItem.path
    const toMove = selectedPaths.has(draggedItem.path)
      ? Array.from(selectedPaths).map(p => displayItems.find(i => i.path === p)).filter(Boolean) as FileItem[]
      : [draggedItem]
    // Skip if dragging a folder onto itself
    const filtered = toMove.filter(f => f.path !== destParent)
    if (!filtered.length) return
    const results = await Promise.allSettled(filtered.map(f => moveFile(f.id, destParent)))
    const ok = results.filter(r => r.status === "fulfilled").length
    if (ok > 0) {
      toast.success(`${ok} öğe "${targetItem.name}" klasörüne taşındı`)
      setSelectedPaths(new Set())
      window.dispatchEvent(new Event("wms:files:changed"))
    } else {
      toast.error("Taşıma başarısız")
    }
  }, [selectedPaths, displayItems])

  // ── select-all ────────────────────────────────────────────────────────────
  const selectableItems = React.useMemo(
    () => displayItems.filter(i => i.name !== ".."),
    [displayItems]
  )
  const allSelected = selectableItems.length > 0 && selectableItems.every(i => selectedPaths.has(i.path))
  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedPaths(new Set())
      setActiveItem(null)
    } else {
      setSelectedPaths(new Set(selectableItems.map(i => i.path)))
      if (selectableItems[0]) setActiveItem(selectableItems[0])
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, item: FileItem) => {
    if (item.name === ".." || item.isDriveFile) {
      e.preventDefault()
      return
    }
    e.dataTransfer.setData("application/workos-file", item.path)
    e.dataTransfer.effectAllowed = "move"
    const ghost = document.createElement("div")
    ghost.className =
      "bg-primary text-primary-foreground px-3 py-1.5 rounded-lg text-xs font-bold shadow-xl border border-white/20"
    ghost.innerText =
      selectedPaths.size > 1 ? `Moving ${selectedPaths.size} items` : `Moving ${item.name}`
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDrop = async (e: React.DragEvent, targetItem: FileItem) => {
    e.preventDefault()
    if (targetItem.type !== "folder" || targetItem.isDriveFile) return
    const sourcePath = e.dataTransfer.getData("application/workos-file")
    if (!sourcePath || sourcePath === targetItem.path) return
    const itemsToMove = selectedPaths.has(sourcePath) ? Array.from(selectedPaths) : [sourcePath]
    const results = await Promise.allSettled(
      itemsToMove.map((p) => {
        const fileItem = displayItems.find((i) => i.path === p)
        if (!fileItem) return Promise.reject(new Error("not found"))
        return moveFile(fileItem.id, targetItem.path)
      })
    )
    const successCount = results.filter((r) => r.status === "fulfilled").length
    if (successCount > 0) {
      toast.success(
        `${successCount} öğe "${targetItem.name === ".." ? "üst klasör" : targetItem.name}"e taşındı`
      )
      setSelectedPaths(new Set())
      window.dispatchEvent(new Event("wms:files:changed"))
    }
  }

  const sortIcon = (col: "name" | "size" | "updatedAt") =>
    sortKey !== col ? (
      <ChevronsUpDownIcon className="ml-1 inline size-3 opacity-40" />
    ) : sortDir === "asc" ? (
      <ChevronUpIcon className="ml-1 inline size-3" />
    ) : (
      <ChevronDownIcon className="ml-1 inline size-3" />
    )

  const folderChoices = displayItems.filter(
    (i) => i.type === "folder" && i.name !== ".." && !moveSourcePaths.includes(i.path)
  )

  const isCutItem = (path: string) =>
    clipboard?.mode === "cut" && clipboard.paths.includes(path)

  return (
    <DndContext sensors={sensors} onDragStart={handleDndDragStart} onDragEnd={handleDndDragEnd}>
    <UploadQueueProvider>
    <>
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/50">
        <FileToolbar currentPath={currentPath} />
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => router.push("/files?view=trash")}
        >
          <Trash2Icon className="size-3.5" />
          Çöp Kutusu
        </Button>
        {/* Local search input + filter popover */}
        <div className="flex items-center gap-1.5 flex-1 max-w-xs ml-auto">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="search"
              placeholder="Ara…"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              className="pl-8 h-7 text-xs"
            />
            {localQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => { setLocalQuery(""); setLocalSearchResults(null) }}
              >
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </div>
          {(() => {
            const activeCount = Object.values(searchFilters).filter((v) => v !== undefined && v !== null).length
            return (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={activeCount > 0 ? "default" : "ghost"} size="sm" className="h-7 px-2 shrink-0">
                    <SlidersHorizontalIcon className="h-3.5 w-3.5" />
                    {activeCount > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 min-w-4 rounded-full px-1 text-[10px]">{activeCount}</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="p-0 w-auto border-0 shadow-none bg-transparent">
                  <SearchFilterPanel
                    filters={searchFilters}
                    onChange={setSearchFilters}
                    onClear={() => setSearchFilters({})}
                  />
                </PopoverContent>
              </Popover>
            )
          })()}
        </div>
      </div>
      <StarredStrip currentPath={currentPath} onOpen={handleItemDoubleClick} />
      <FileDropZone currentPath={currentPath}>
      <div
        ref={containerRef}
        className="relative flex min-h-0 flex-1 overflow-hidden select-none"
        onClick={() => {
          setSelectedPaths(new Set())
          setActiveItem(null)
        }}
      >
        <SelectionLasso containerRef={containerRef} onSelectionChange={handleLassoChange} />

        <div className="scrollbar-thin flex-1 overflow-x-hidden overflow-y-auto">
          {localSearching && localSearchResults === null ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
              <div className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
              <p className="text-sm">Aranıyor…</p>
            </div>
          ) : localSearchResults != null ? (
            <SearchResultsView
              results={localSearchResults}
              query={localQuery}
              onOpen={handleItemDoubleClick}
              onDownload={(item) => downloadFile(item)}
              onRename={handleRename}
              onDelete={(path) => handleDeleteConfirm(path)}
              onMoveTo={(paths) => handleMoveToOpen(paths)}
            />
          ) : viewMode === "list" ? (
            <div className="flex h-full flex-col border-t border-border bg-card">
              <Table className="w-full table-fixed">
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-b border-border hover:bg-transparent">
                                        <TableHead
                      className="w-[45%] cursor-pointer px-6 text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("name")}
                    >
                      Ad {sortIcon("name")}
                    </TableHead>
                    <TableHead className="w-[12%] text-[10px] font-bold tracking-wider uppercase select-none">
                      Tür
                    </TableHead>
                    <TableHead
                      className="w-[13%] cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("size")}
                    >
                      Boyut {sortIcon("size")}
                    </TableHead>
                    <TableHead
                      className="w-[25%] cursor-pointer text-[10px] font-bold tracking-wider uppercase select-none"
                      onClick={() => handleSort("updatedAt")}
                    >
                      Değiştirilme {sortIcon("updatedAt")}
                    </TableHead>
                    <TableHead className="w-[5%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayItems.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="h-64 text-center text-muted-foreground"
                      >
                        <div className="flex flex-col items-center gap-2">
                          <FolderIcon className="size-12 opacity-10" />
                          <p>Bu dizinde dosya bulunamadı.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                  {displayItems.map((item) => {
                    const isSelected = selectedPaths.has(item.path)
                    const isParentDir = item.name === ".."
                    const isCut = !isParentDir && isCutItem(item.path)
                    const isDrive = item.isDriveFile

                    const tableRow = (
                      <DndTableRow
                        key={item.path + item.name}
                        item={item}
                        className={cn(
                          "group cursor-pointer border-b border-border/50 transition-colors last:border-0",
                          isSelected
                            ? "bg-primary/5 hover:bg-primary/10"
                            : "hover:bg-muted/30",
                          isParentDir && "text-muted-foreground/60",
                          isCut && "opacity-40"
                        )}
                        onClick={(e: React.MouseEvent<HTMLTableRowElement>) => {
                          e.stopPropagation()
                          handleSelect(item, e.shiftKey || e.metaKey || e.ctrlKey)
                        }}
                        onDoubleClick={(e: React.MouseEvent<HTMLTableRowElement>) => {
                          e.stopPropagation()
                          handleItemDoubleClick(item)
                        }}
                      >
                        <TableCell className="px-6 py-3 font-medium">
                          <div className="flex items-center gap-3">
                            <FileThumbnail item={item} />
                            <span className="truncate text-sm">{item.name}</span>
                            {!isParentDir && (
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  try {
                                    const updated = await starFile(item.id)
                                    setLocalItems(prev =>
                                      prev.map(i => i.id === item.id ? { ...i, is_starred: updated.is_starred } : i)
                                    )
                                  } catch { /* ignore */ }
                                }}
                                className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto shrink-0 p-0.5 rounded hover:bg-accent"
                                onPointerDown={(e) => e.stopPropagation()}
                              >
                                <StarIcon
                                  className={cn(
                                    "size-3.5",
                                    item.is_starred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
                                  )}
                                />
                              </button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {!isParentDir && (
                            <FileTypeBadge item={item} />
                          )}
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {item.type === "folder" ? "--" : formatSize(item.size)}
                        </TableCell>
                        <TableCell className="font-sans text-xs text-muted-foreground">
                          {isParentDir || !item.lastModified ? "--" : format(new Date(item.lastModified), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                          className="px-6 py-0"
                        >
                          {!isParentDir && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 opacity-0 group-hover:opacity-100"
                                >
                                  <MoreVerticalIcon className="size-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem
                                  className="gap-2"
                                  onClick={() => handleItemDoubleClick(item)}
                                >
                                  <ExternalLinkIcon className="size-3.5" /> Aç
                                </DropdownMenuItem>
                                {!item.isDriveFile && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => handleSingleItemDownload(item)}
                                  >
                                    <DownloadIcon className="size-3.5" /> İndir
                                  </DropdownMenuItem>
                                )}
                                {item.type === "folder" && !isPinned(item.path) && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => pin({ name: item.name, path: item.path })}
                                  >
                                    <PinIcon className="size-3.5" /> Sabitle
                                  </DropdownMenuItem>
                                )}
                                {item.type === "folder" && !isDrive && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => setCustomizeDialogItem(item)}
                                  >
                                    <PaletteIcon className="size-3.5" /> Özelleştir
                                  </DropdownMenuItem>
                                )}
                                {!isDrive && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => setShareTarget(item)}
                                  >
                                    <Share2Icon className="size-3.5" /> Paylaş
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {canMove && !isDrive && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => handleCopy([item.path])}
                                  >
                                    <CopyIcon className="size-3.5" /> Kopyala
                                  </DropdownMenuItem>
                                )}
                                {canMove && !isDrive && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => handleCut([item.path])}
                                  >
                                    <ScissorsIcon className="size-3.5" /> Kes
                                  </DropdownMenuItem>
                                )}
                                {canRename && !isDrive && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2"
                                      onClick={() => handleRename(item)}
                                    >
                                      <PencilIcon className="size-3.5" /> Yeniden Adlandır
                                    </DropdownMenuItem>
                                  </>
                                )}
                                {canMove && !isDrive && (
                                  <DropdownMenuItem
                                    className="gap-2"
                                    onClick={() => handleMoveToOpen([item.path])}
                                  >
                                    <MoveIcon className="size-3.5" /> Taşı
                                  </DropdownMenuItem>
                                )}
                                {canDelete && !isDrive && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="gap-2 text-destructive focus:text-destructive"
                                      onClick={() => handleDeleteConfirm(item.path)}
                                    >
                                      <Trash2Icon className="size-3.5" /> Sil
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </TableCell>
                      </DndTableRow>
                    )

                    if (isParentDir) return tableRow

                    return (
                      <ContextMenu key={item.path}>
                        <ContextMenuTrigger asChild>{tableRow}</ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem
                            className="gap-2"
                            onClick={async () => {
                              if (item.type === "folder") {
                                window.open(`/files/${item.path}`, "_blank")
                              } else {
                                try {
                                  const { getPreviewUrl } = await import("@/lib/actions/files")
                                  const url = await getPreviewUrl(item.id)
                                  window.open(url ?? getFileOpenUrl(item), "_blank")
                                } catch {
                                  window.open(getFileOpenUrl(item), "_blank")
                                }
                              }
                            }}
                          >
                            <ExternalLinkIcon className="size-4" /> Aç
                          </ContextMenuItem>
                          <ContextMenuSub>
                            <ContextMenuSubTrigger className="gap-2">
                              <Share2Icon className="size-4" /> Birlikte Aç
                            </ContextMenuSubTrigger>
                            <ContextMenuSubContent className="w-44">
                              <ContextMenuItem className="gap-2" onClick={() => {}}>
                                <ExternalLinkIcon className="size-4" /> Metin Editörü
                              </ContextMenuItem>
                              <ContextMenuItem className="gap-2" onClick={() => {}}>
                                <ExternalLinkIcon className="size-4" /> Web Tarayıcısı
                              </ContextMenuItem>
                            </ContextMenuSubContent>
                          </ContextMenuSub>
                          {!item.isDriveFile && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => handleSingleItemDownload(item)}
                            >
                              <DownloadIcon className="size-4" /> İndir
                            </ContextMenuItem>
                          )}
                          {item.type === "folder" && !isPinned(item.path) && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => pin({ name: item.name, path: item.path })}
                            >
                              <PinIcon className="size-4" /> Sabitle
                            </ContextMenuItem>
                          )}
                          {item.type === "folder" && !isDrive && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => setCustomizeDialogItem(item)}
                            >
                              <PaletteIcon className="size-4" /> Özelleştir
                            </ContextMenuItem>
                          )}
                          {!isDrive && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => setShareTarget(item)}
                            >
                              <Share2Icon className="size-4" /> Paylaş
                            </ContextMenuItem>
                          )}
                          <ContextMenuSeparator />
                          {canMove && !isDrive && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => handleCopy([item.id])}
                            >
                              <CopyIcon className="size-4" /> Kopyala
                            </ContextMenuItem>
                          )}
                          {canMove && !isDrive && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => handleCut([item.id])}
                            >
                              <ScissorsIcon className="size-4" /> Kes
                            </ContextMenuItem>
                          )}
                          {canRename && !isDrive && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                className="gap-2"
                                onClick={() => handleRename(item)}
                              >
                                <PencilIcon className="size-4" /> Yeniden Adlandır
                              </ContextMenuItem>
                            </>
                          )}
                          {canMove && !isDrive && (
                            <ContextMenuItem
                              className="gap-2"
                              onClick={() => handleMoveToOpen([item.id])}
                            >
                              <MoveIcon className="size-4" /> Taşı
                            </ContextMenuItem>
                          )}
                          {canDelete && !isDrive && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                className="gap-2 text-destructive focus:text-destructive"
                                onClick={() => handleDeleteConfirm(item.id)}
                              >
                                <Trash2Icon className="size-4" /> Sil
                              </ContextMenuItem>
                            </>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    )
                  })}
                </TableBody>
              </Table>
              <div className="flex-1" />
            </div>
          ) : (
            <FileGrid
              items={displayItems}
              selectedPaths={selectedPaths}
              onSelect={handleSelect}
              onNavigate={(p) => {
                const qs = sourceFilter !== "all" ? `?source=${sourceFilter}` : ""
                router.push(`/files/${p}${qs}`)
              }}
              currentPath={currentPath}
              onRename={handleRename}
              onDelete={(path) => handleDeleteConfirm(path)}
              onMoveTo={(paths) => handleMoveToOpen(paths)}
              onDownload={handleSingleItemDownload}
              clipboard={clipboard}
              onCopy={handleCopy}
              onCut={handleCut}
            />
          )}
        </div>

        {internalPreviewOpen && internalPreviewFile && (
          <FilePreviewPanel
            file={internalPreviewFile}
            open={internalPreviewOpen}
            onClose={() => { setInternalPreviewOpen(false); setInternalPreviewFile(null) }}
          />
        )}

        {selectedPaths.size >= 1 && (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
            <span className="mr-2 text-sm font-semibold tabular-nums">
              {selectedPaths.size} seçili
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 text-xs"
              onClick={handleBulkDownload}
            >
              <DownloadIcon className="size-3.5" /> İndir
            </Button>
            {canMove && (() => {
              const diskItems = Array.from(selectedPaths)
                .map(p => items.find(i => i.path === p))
                .filter((i): i is typeof items[number] => !!i && !i.isDriveFile)
              const diskIds = diskItems.map(i => i.id).filter(Boolean)
              return diskIds.length > 0 ? (
                <>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => handleCopy(diskIds)}>
                    <CopyIcon className="size-3.5" /> Kopyala
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => handleCut(diskIds)}>
                    <ScissorsIcon className="size-3.5" /> Kes
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" onClick={() => handleMoveToOpen(diskIds)}>
                    <MoveIcon className="size-3.5" /> Taşı
                  </Button>
                </>
              ) : null
            })()}
            {canDelete && (() => {
              const diskIds = Array.from(selectedPaths)
                .map(p => items.find(i => i.path === p))
                .filter((i): i is typeof items[number] => !!i && !i.isDriveFile)
                .map(i => i.id)
                .filter(Boolean)
              return diskIds.length > 0 ? (
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleDeleteConfirm(diskIds)}>
                  <Trash2Icon className="size-3.5" /> Sil
                </Button>
              ) : null
            })()}
            <Button
              size="sm"
              variant="ghost"
              className="ml-1 size-7 p-0"
              onClick={() => {
                setSelectedPaths(new Set())
                setActiveItem(null)
              }}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}

        {clipboard && selectedPaths.size < 2 && (
          <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-xl border border-primary/30 bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-md">
            <ClipboardPasteIcon className="size-3.5 text-primary" />
            <span className="text-sm text-muted-foreground">
              {clipboard.paths.length === 1 ? "1 öğe" : `${clipboard.paths.length} öğe`}
              {clipboard.mode === "cut" ? " kesildi" : " kopyalandı"}
            </span>
            <Button
              size="sm"
              variant="default"
              className="ml-1 h-7 gap-1.5 text-xs"
              onClick={handlePaste}
            >
              <ClipboardPasteIcon className="size-3.5" /> Yapıştır
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="size-7 p-0 text-muted-foreground"
              onClick={() => setClipboard(null)}
            >
              <XIcon className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeniden Adlandır</DialogTitle>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") doRename()
              if (e.key === "Escape") setRenameOpen(false)
            }}
            autoFocus
            className="mt-1"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              İptal
            </Button>
            <Button onClick={doRename} disabled={!renameValue.trim()}>
              Yeniden Adlandır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletePaths.length === 1 ? "Bu öğe çöp kutusuna taşınsın mı?" : `${deletePaths.length} öğe çöp kutusuna taşınsın mı?`}
            </AlertDialogTitle>
            <AlertDialogDescription>Öğeler 7 gün sonra otomatik olarak kalıcı şekilde silinir.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Çöp Kutusuna Taşı
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={moveToOpen} onOpenChange={setMoveToOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Taşı</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Mevcut dizinde bir hedef klasör seçin:
            </p>
            {folderChoices.length === 0 ? (
              <p className="rounded-lg bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
                Burada klasör yok. Aşağıya bir yol yazın.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
                {folderChoices.map((folder) => (
                  <button
                    key={folder.path}
                    type="button"
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                      moveToTarget === folder.path && "bg-primary/10 text-primary"
                    )}
                    onClick={() => setMoveToTarget(folder.path)}
                  >
                    <FolderIcon className="size-4 shrink-0 fill-blue-500/20 text-blue-500" />
                    {folder.name}
                  </button>
                ))}
              </div>
            )}
            <Input
              placeholder="Veya bir yol yazın (örn. Belgeler/Projeler)"
              value={moveToTarget}
              onChange={(e) => setMoveToTarget(e.target.value)}
              className="text-xs"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMoveToOpen(false)}>
              İptal
            </Button>
            <Button onClick={doMoveTo} disabled={!moveToTarget.trim()}>
              Taşı
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </FileDropZone>
    </>
    </UploadQueueProvider>

      {/* Share Dialog */}
      {shareTarget && (
        <ShareDialog
          file={shareTarget}
          open={!!shareTarget}
          onClose={() => setShareTarget(null)}
        />
      )}

      
      {/* dnd-kit drag ghost */}
      <DragOverlay dropAnimation={null}>
        {dndActiveItem && (
          <div className="flex items-center gap-2 rounded-lg border border-white/20 bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground shadow-xl">
            <FileIcon className="size-3.5" />
            {selectedPaths.size > 1 ? `${selectedPaths.size} dosya seçildi` : dndActiveItem.name}
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}