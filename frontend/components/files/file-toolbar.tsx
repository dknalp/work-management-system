"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, UploadIcon, FolderUpIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
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
import { createFolder } from "@/lib/actions/files"
import { uploadFile } from "@/lib/actions/upload"
import { toast } from "sonner"

interface FileToolbarProps {
  currentPath: string
}

export function FileToolbar({ currentPath }: FileToolbarProps) {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const folderInputRef = React.useRef<HTMLInputElement>(null)
  const [folderDialogOpen, setFolderDialogOpen] = React.useState(false)
  const [folderName, setFolderName] = React.useState("")

  // Overwrite conflict state
  const [conflictFiles, setConflictFiles] = React.useState<File[]>([])
  const [conflictOpen, setConflictOpen] = React.useState(false)

  React.useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "")
      folderInputRef.current.setAttribute("directory", "")
    }
  }, [])

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return
    const res = await createFolder(currentPath, folderName.trim())
    if (res.success) {
      toast.success("Folder created")
      setFolderDialogOpen(false)
      setFolderName("")
      router.refresh()
    } else {
      toast.error("Failed to create folder")
    }
  }

  const doUpload = async (files: File[], overwrite = false) => {
    if (files.length === 0) return
    const toastId = toast.loading(`Uploading ${files.length} file(s)…`)

    const results = await Promise.all(
      files.map((file) => {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("path", currentPath)
        if (overwrite) formData.append("overwrite", "true")
        return uploadFile(formData)
      })
    )

    const conflicts = results
      .map((r, i) => (r.conflict ? files[i] : null))
      .filter(Boolean) as File[]
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success && !r.conflict).length

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded`, { id: toastId })
      router.refresh()
    } else if (conflicts.length === 0) {
      toast.dismiss(toastId)
    } else {
      toast.dismiss(toastId)
    }

    if (failCount > 0) {
      toast.error(`${failCount} upload(s) failed`)
    }

    if (conflicts.length > 0) {
      setConflictFiles(conflicts)
      setConflictOpen(true)
    }
  }

  const uploadFiles = async (files: FileList) => {
    await doUpload(Array.from(files))
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    uploadFiles(e.target.files)
    e.target.value = ""
  }

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    uploadFiles(e.target.files)
    e.target.value = ""
  }

  const handleOverwriteConfirm = async () => {
    setConflictOpen(false)
    await doUpload(conflictFiles, true)
    setConflictFiles([])
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-9 gap-2"
          onClick={() => fileInputRef.current?.click()}
        >
          <UploadIcon className="size-4" />
          Upload
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => folderInputRef.current?.click()}
        >
          <FolderUpIcon className="size-4" />
          Upload Folder
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2"
          onClick={() => {
            setFolderName("")
            setFolderDialogOpen(true)
          }}
        >
          <PlusIcon className="size-4" />
          New Folder
        </Button>
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          multiple
          onChange={handleUpload}
        />
        <input
          type="file"
          ref={folderInputRef}
          className="hidden"
          multiple
          onChange={handleFolderUpload}
        />
      </div>

      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Folder name"
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateFolder()
              if (e.key === "Escape") setFolderDialogOpen(false)
            }}
            autoFocus
            className="mt-1"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFolder} disabled={!folderName.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflictFiles.length === 1
                ? `"${conflictFiles[0]?.name}" already exists`
                : `${conflictFiles.length} files already exist`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {conflictFiles.length === 1
                ? "Do you want to replace the existing file?"
                : `Do you want to replace all ${conflictFiles.length} existing files?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConflictFiles([])}>Keep original</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwriteConfirm}>
              Replace
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}