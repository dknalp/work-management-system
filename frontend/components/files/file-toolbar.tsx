"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FolderPlusIcon,
  UploadIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { createFolder } from "@/lib/actions/files"
import { uploadFile } from "@/lib/actions/upload"
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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { usePermission } from "@/hooks/use-permission"

interface FileToolbarProps {
  currentPath: string
  isDriveView?: boolean
}

export function FileToolbar({ currentPath, isDriveView = false }: FileToolbarProps) {
  const router = useRouter()
  const canUpload = usePermission("files:upload")
  const canCreateFolder = usePermission("files:create_folder")
  const [newFolderOpen, setNewFolderOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const [conflictFiles, setConflictFiles] = React.useState<File[]>([])
  const [conflictOpen, setConflictOpen] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const doUpload = async (files: File[], overwrite = false) => {
    const toastId = toast.loading(`${files.length} dosya yükleniyor…`)
    const CONCURRENCY = 3
    const queue = [...files]
    const results: Awaited<ReturnType<typeof uploadFile>>[] = []
    async function worker() {
      while (queue.length > 0) {
        const file = queue.shift()!
        const fd = new FormData()
        fd.append("file", file)
        fd.append("path", currentPath)
        if (overwrite) fd.append("overwrite", "true")
        results.push(await uploadFile(fd))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()))
    const successCount = results.filter((r) => r.success).length
    const conflicts = results.map((r, i) => (r.conflict ? files[i] : null)).filter(Boolean) as File[]
    if (successCount > 0) {
      toast.success(`${successCount} dosya yüklendi`, { id: toastId })
      router.refresh()
      window.dispatchEvent(new Event("wms:files:changed"))
    } else {
      toast.dismiss(toastId)
    }
    if (conflicts.length > 0) {
      setConflictFiles(conflicts)
      setConflictOpen(true)
    }
  }

  const handleOverwriteConfirm = async () => {
    setConflictOpen(false)
    await doUpload(conflictFiles, true)
    setConflictFiles([])
  }

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    setCreating(true)
    const res = await createFolder(currentPath, folderName.trim())
    if (res.success) {
      toast.success(`"${folderName}" klasörü oluşturuldu`)
      setNewFolderOpen(false)
      setFolderName("")
      router.refresh()
    } else {
      toast.error(res.error ?? "Klasör oluşturulamadı")
    }
    setCreating(false)
  }

  if (isDriveView) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground"
          onClick={() => router.refresh()}
        >
          <RefreshCwIcon className="size-3.5" />
          Yenile
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex items-center gap-1">
        {canUpload && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadIcon className="size-3.5" />
              Yükle
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={async (e) => {
                const files = e.target.files
                if (!files?.length) return
                await doUpload(Array.from(files))
                e.target.value = ""
              }}
            />
          </>
        )}
        {canCreateFolder && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              setFolderName("")
              setNewFolderOpen(true)
            }}
          >
            <FolderPlusIcon className="size-3.5" />
            Klasör
          </Button>
        )}
      </div>

      {/* Upload conflict dialog */}
      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflictFiles.length === 1
                ? `"${conflictFiles[0]?.name}" zaten mevcut`
                : `${conflictFiles.length} dosya zaten mevcut`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflictFiles.length === 1
                ? "Mevcut dosyanın üzerine yazmak ister misiniz?"
                : `Mevcut ${conflictFiles.length} dosyanın üzerine yazmak ister misiniz?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictFiles([])}>Orijinali koru</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm}>Üzerine yaz</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* New folder dialog */}
      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Yeni Klasör</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Klasör adı"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder()
              if (e.key === "Escape") setNewFolderOpen(false)
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewFolderOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim() || creating}>
              {creating ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}