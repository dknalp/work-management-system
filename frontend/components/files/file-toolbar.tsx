"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, UploadIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createFolder } from "@/lib/actions/files"
import { uploadFile } from "@/lib/actions/upload"
import { toast } from "sonner"

interface FileToolbarProps {
  currentPath: string
}

export function FileToolbar({ currentPath }: FileToolbarProps) {
  const router = useRouter()
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleCreateFolder = async () => {
    const name = prompt("Enter folder name:")
    if (name) {
      const res = await createFolder(currentPath, name)
      if (res.success) {
        toast.success("Folder created")
        router.refresh()
      } else {
        toast.error("Failed to create folder")
      }
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)
    formData.append("path", currentPath)

    const res = await uploadFile(formData)
    if (res.success) {
      toast.success("File uploaded")
      router.refresh()
    } else {
      toast.error("Upload failed")
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        className="h-9 gap-2"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadIcon className="size-4" />
        Upload File
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2"
        onClick={handleCreateFolder}
      >
        <PlusIcon className="size-4" />
        New Folder
      </Button>
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  )
}
