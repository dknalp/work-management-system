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
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface FileToolbarProps {
  currentPath: string
  isDriveView?: boolean
}

export function FileToolbar({ currentPath, isDriveView = false }: FileToolbarProps) {
  const router = useRouter()
  const [newFolderOpen, setNewFolderOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState("")
  const [creating, setCreating] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

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
            const toastId = toast.loading(`${files.length} dosya yükleniyor…`)
            await Promise.all(Array.from(files).map((file) => {
              const fd = new FormData()
              fd.append("file", file)
              fd.append("path", currentPath)
              return uploadFile(fd)
            }))
            toast.success("Dosyalar yüklendi", { id: toastId })
            router.refresh()
            e.target.value = ""
          }}
        />
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
      </div>

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