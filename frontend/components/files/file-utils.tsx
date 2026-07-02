"use client"

import {
  FileIcon,
  FolderIcon,
  FileTextIcon,
  ImageIcon,
  FileBoxIcon,
  VideoIcon,
  MusicIcon,
  TableIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { FileItem } from "@/lib/actions/files"

export function getFileIcon(item: FileItem, size = "size-4") {
  if (item.isDirectory)
    return <FolderIcon className={cn(size, "fill-blue-500/20 text-blue-500")} />
  const ext = item.name.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "txt":
    case "md":
      return <FileTextIcon className={cn(size, "text-muted-foreground")} />
    case "doc":
    case "docx":
      return <FileTextIcon className={cn(size, "text-blue-500")} />
    case "pdf":
      return <FileIcon className={cn(size, "text-rose-500")} />
    case "xls":
    case "xlsx":
    case "csv":
      return <TableIcon className={cn(size, "text-green-500")} />
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
    case "webp":
      return <ImageIcon className={cn(size, "text-orange-500")} />
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
    case "webm":
      return <VideoIcon className={cn(size, "text-violet-500")} />
    case "mp3":
    case "wav":
    case "flac":
    case "ogg":
    case "aac":
      return <MusicIcon className={cn(size, "text-amber-500")} />
    case "js":
    case "ts":
    case "jsx":
    case "tsx":
    case "py":
    case "css":
    case "html":
    case "json":
      return <FileTextIcon className={cn(size, "text-cyan-500")} />
    case "zip":
    case "rar":
    case "tar":
    case "gz":
      return <FileBoxIcon className={cn(size, "text-purple-500")} />
    default:
      return <FileIcon className={cn(size, "text-muted-foreground")} />
  }
}

export function isImageFile(name: string) {
  return /\.(jpg|jpeg|png|svg|gif|webp)$/i.test(name)
}

export function isTextFile(name: string) {
  return /\.(txt|md|json|js|ts|css|html)$/i.test(name)
}

export function getFileOpenUrl(item: FileItem): string {
  if (item.source === "drive" && item.driveFileId) {
    return `https://drive.google.com/file/d/${item.driveFileId}/view`
  }
  return `/api/files/raw?path=${encodeURIComponent(item.path)}`
}

export function getFileDownloadUrl(item: FileItem): string {
  if (item.source === "drive" && item.driveFileId) {
    return `https://drive.google.com/uc?export=download&id=${item.driveFileId}`
  }
  return `/api/files/raw?path=${encodeURIComponent(item.path)}`
}

export function downloadFile(item: FileItem) {
  if (item.source === "drive" && item.driveFileId) {
    window.open(getFileDownloadUrl(item), "_blank")
    return
  }
  const a = document.createElement("a")
  a.href = getFileDownloadUrl(item)
  a.download = item.name
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

export function formatSize(bytes: number) {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}