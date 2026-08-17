"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  FolderPlusIcon,
  UploadIcon,
  RefreshCwIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { usePermission } from "@/hooks/use-permission"
import { createFolder } from "@/lib/actions/files"
import { useUploadQueue } from "@/components/files/upload-queue"

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
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)
  const { addFiles } = useUploadQueue()

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    setCreating(true)
    try {
      await createFolder(currentPath, folderName.trim())
      toast.success(`"${folderName}" klasörü oluşturuldu`)
      setNewFolderOpen(false)
      setFolderName("")
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Klasör oluşturulamadı")
    } finally {
      setCreating(false)
    }
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
              onChange={(e) => {
                const files = e.target.files
                if (!files?.length) return
                addFiles(Array.from(files), currentPath)
                e.target.value = ""
              }}
            />
            {/* Folder upload */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => folderInputRef.current?.click()}
            >
              <FolderPlusIcon className="size-3.5" />
              Klasör Yükle
            </Button>
            <input
              ref={folderInputRef}
              type="file"
              className="hidden"
              multiple
              {...{ webkitdirectory: "" }}
              onChange={(e) => {
                const rawFiles = Array.from(e.target.files ?? [])
                if (!rawFiles.length) return
                for (const file of rawFiles) {
                  const relativePath = (file as File & { webkitRelativePath?: string })
                    .webkitRelativePath ?? file.name
                  const folderPart = relativePath.substring(0, relativePath.lastIndexOf("/"))
                  const targetPath = currentPath
                    ? folderPart ? `${currentPath}/${folderPart}` : currentPath
                    : folderPart || ""
                  addFiles([file], targetPath)
                }
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