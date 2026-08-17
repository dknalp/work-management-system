"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"
import { useUploadQueue } from "@/components/files/upload-queue"

interface FileDropZoneProps {
  children: React.ReactNode
  currentPath: string
  disabled?: boolean
}

export function FileDropZone({ children, currentPath, disabled = false }: FileDropZoneProps) {
  const dragCounter = React.useRef(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const { addFiles } = useUploadQueue()

  const handleUpload = (files: FileList | File[]) => {
    addFiles(Array.from(files), currentPath)
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

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragging(false)
    if (!disabled && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleUpload(e.dataTransfer.files)
    }
  }

  // Ctrl+V — paste files from OS clipboard into the current folder
  const onPaste = (e: React.ClipboardEvent) => {
    if (disabled) return
    const items = e.clipboardData.items
    const files: File[] = []
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === "file") {
        const file = items[i].getAsFile()
        if (file) files.push(file)
      }
    }
    if (files.length > 0) handleUpload(files)
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
  )
}