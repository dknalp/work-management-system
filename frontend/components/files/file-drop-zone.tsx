"use client"

import * as React from "react"
import { UploadIcon } from "lucide-react"
import { useUploadQueue } from "@/components/files/upload-queue"
import { createFolder } from "@/lib/actions/files"

interface FileDropZoneProps {
  children: React.ReactNode
  currentPath: string
  disabled?: boolean
}

/** Recursively read a FileSystemDirectoryEntry and collect all File objects
 *  with their paths relative to the dropped item's parent. */
function readEntryRecursive(
  entry: FileSystemEntry,
  pathPrefix: string,
  results: { file: File; path: string }[],
): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      ;(entry as FileSystemFileEntry).file((file) => {
        results.push({ file, path: pathPrefix })
        resolve()
      })
    } else if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader()
      const readAll = (accumulated: FileSystemEntry[]) => {
        reader.readEntries((batch) => {
          if (batch.length === 0) {
            // all entries read — recurse into each
            const subdir = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name
            Promise.all(
              accumulated.map((child) => readEntryRecursive(child, subdir, results)),
            ).then(() => resolve())
          } else {
            readAll([...accumulated, ...batch])
          }
        })
      }
      readAll([])
    } else {
      resolve()
    }
  })
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
    if (disabled) return

    // Use DataTransferItemList + webkitGetAsEntry to handle both files and
    // folders. e.dataTransfer.files gives back directory entries as 4096-byte
    // opaque File objects that the browser blocks from being uploaded (ERR_ACCESS_DENIED).
    const items = e.dataTransfer.items
    if (items && items.length > 0) {
      const collected: { file: File; path: string }[] = []
      const promises: Promise<void>[] = []

      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry?.()
        if (!entry) continue

        if (entry.isFile) {
          promises.push(
            new Promise((resolve) => {
              ;(entry as FileSystemFileEntry).file((file) => {
                collected.push({ file, path: currentPath })
                resolve()
              })
            }),
          )
        } else if (entry.isDirectory) {
          // For a dropped folder, files go into currentPath/folderName/...
          const folderPath = currentPath ? `${currentPath}/${entry.name}` : entry.name
          const reader = (entry as FileSystemDirectoryEntry).createReader()
          const readAll = (acc: FileSystemEntry[]): Promise<void> =>
            new Promise((res) => {
              reader.readEntries((batch) => {
                if (batch.length === 0) {
                  Promise.all(
                    acc.map((child) => readEntryRecursive(child, folderPath, collected)),
                  ).then(() => res())
                } else {
                  readAll([...acc, ...batch]).then(res)
                }
              })
            })
          promises.push(readAll([]))
        }
      }

      Promise.all(promises).then(async () => {
        if (collected.length === 0) return

        // Collect all unique folder paths that need to exist
        const folderPaths = new Set<string>()
        for (const { path } of collected) {
          // e.g. path="imgs/sub" → need "imgs" and "imgs/sub"
          const parts = path.split("/").filter(Boolean)
          let acc = ""
          for (const part of parts) {
            acc = acc ? `${acc}/${part}` : part
            folderPaths.add(acc)
          }
        }

        // Create folder records from shallowest to deepest (order matters)
        const sortedFolders = Array.from(folderPaths).sort(
          (a, b) => a.split("/").length - b.split("/").length,
        )
        for (const folderPath of sortedFolders) {
          const parts = folderPath.split("/")
          const name = parts[parts.length - 1]
          const parent = parts.slice(0, -1).join("/")
          try {
            await createFolder(parent, name)
          } catch {
            // folder may already exist — ignore
          }
        }

        // Group files by target path and upload
        const byPath = new Map<string, File[]>()
        for (const { file, path } of collected) {
          const arr = byPath.get(path) ?? []
          arr.push(file)
          byPath.set(path, arr)
        }
        for (const [path, files] of byPath) {
          addFiles(files, path)
        }
      })
      return
    }

    // Fallback for browsers without webkitGetAsEntry (very old)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
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