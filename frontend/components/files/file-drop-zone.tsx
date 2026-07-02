"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { uploadFile } from "@/lib/actions/upload"
import { toast } from "sonner"
import { UploadIcon } from "lucide-react"
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

interface FileDropZoneProps {
  children: React.ReactNode
  currentPath: string
  disabled?: boolean
}

export function FileDropZone({ children, currentPath, disabled = false }: FileDropZoneProps) {
  const router = useRouter()
  const dragCounter = React.useRef(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [conflictFiles, setConflictFiles] = React.useState<File[]>([])
  const [conflictOpen, setConflictOpen] = React.useState(false)

  const doUpload = async (files: File[], overwrite = false) => {
    const toastId = toast.loading(`Uploading ${files.length} file(s)…`)

    const CONCURRENCY = 3
    const queue = [...files]
    const results: Awaited<ReturnType<typeof uploadFile>>[] = []
    async function worker() {
      while (queue.length > 0) {
        const file = queue.shift()!
        const formData = new FormData()
        formData.append("file", file)
        formData.append("path", currentPath)
        if (overwrite) formData.append("overwrite", "true")
        results.push(await uploadFile(formData))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, () => worker()))

    const conflicts = results
      .map((r, i) => (r.conflict ? files[i] : null))
      .filter(Boolean) as File[]
    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success && !r.conflict).length

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded`, { id: toastId })
      router.refresh()
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

  const handleUpload = async (files: FileList | File[]) => {
    await doUpload(Array.from(files))
  }

  const handleOverwriteConfirm = async () => {
    setConflictOpen(false)
    await doUpload(conflictFiles, true)
    setConflictFiles([])
  }

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    const isFile = e.dataTransfer.types.includes("Files")
    if (!isFile || disabled) return
    dragCounter.current++
    if (dragCounter.current === 1) setIsDragging(true)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy"
    }
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    const isFile = e.dataTransfer.types.includes("Files")
    if (!isFile) return
    dragCounter.current--
    if (dragCounter.current === 0) setIsDragging(false)
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files)
    }
  }

  const onPaste = async (e: React.ClipboardEvent) => {
    if (disabled) return
    const items = e.clipboardData.items
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) await handleUpload(files)
  }

  return (
    <>
      <div
        className="relative flex flex-1 flex-col"
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onPaste={onPaste}
      >
        {children}

        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 m-4 flex animate-in flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px] duration-200 zoom-in-95 fade-in">
            <div className="mb-4 flex size-16 scale-110 items-center justify-center rounded-full border border-primary/20 bg-background shadow-xl">
              <UploadIcon className="size-8 animate-bounce text-primary" />
            </div>
            <h3 className="text-xl font-bold tracking-tight text-primary">
              Yüklemek için dosyaları bırakın
            </h3>
            <p className="text-sm font-medium text-primary/70">
              {currentPath || "kök"} konumuna
            </p>
          </div>
        )}
      </div>

      <AlertDialog open={conflictOpen} onOpenChange={setConflictOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {conflictFiles.length === 1
                ? `"${conflictFiles[0]?.name}" already exists`
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
    </>
  )
}