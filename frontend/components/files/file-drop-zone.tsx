"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { uploadFile } from "@/lib/actions/upload"
import { toast } from "sonner"
import { UploadIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileDropZoneProps {
  children: React.ReactNode
  currentPath: string
}

export function FileDropZone({ children, currentPath }: FileDropZoneProps) {
  const router = useRouter()
  const dragCounter = React.useRef(0)
  const [isDragging, setIsDragging] = React.useState(false)

  const handleUpload = async (files: FileList | File[]) => {
    const uploadPromises = Array.from(files).map(async (file) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("path", currentPath)
      return uploadFile(formData)
    })

    const results = await Promise.all(uploadPromises)
    const successCount = results.filter((r) => r.success).length

    if (successCount > 0) {
      toast.success(`${successCount} file(s) uploaded`)
      router.refresh()
    }

    if (successCount < results.length) {
      toast.error(`${results.length - successCount} upload(s) failed`)
    }
  }

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault()

    // Only show upload overlay for external files
    const isFile = e.dataTransfer.types.includes("Files")
    if (!isFile) return

    dragCounter.current++
    if (dragCounter.current === 1) {
      setIsDragging(true)
    }
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    // Ensure dropEffect is set correctly for files
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy"
    }
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()

    const isFile = e.dataTransfer.types.includes("Files")
    if (!isFile) return

    dragCounter.current--
    if (dragCounter.current === 0) {
      setIsDragging(false)
    }
  }

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files)
    }
  }

  const onPaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    const files: File[] = []

    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }

    if (files.length > 0) {
      await handleUpload(files)
    }
  }

  return (
    <div
      className="relative flex flex-1 flex-col"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
    >
      {children}

      {/* Overlay UI */}
      {isDragging && (
        <div className="pointer-events-none absolute inset-0 z-50 m-4 flex animate-in flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 backdrop-blur-[2px] duration-200 zoom-in-95 fade-in">
          <div className="mb-4 flex size-16 scale-110 items-center justify-center rounded-full border border-primary/20 bg-background shadow-xl">
            <UploadIcon className="size-8 animate-bounce text-primary" />
          </div>
          <h3 className="text-xl font-bold tracking-tight text-primary">
            Drop files to upload
          </h3>
          <p className="text-sm font-medium text-primary/70">
            to {currentPath || "root"}
          </p>
        </div>
      )}
    </div>
  )
}
