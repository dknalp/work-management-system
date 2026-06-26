"use server"

import { google } from "googleapis"
import { FileItem } from "./files"
import {
  loadCredentials,
  deleteCredentials,
  getAuthorizedClient,
  getAuthUrl,
} from "@/lib/google-oauth"

export type DriveConnectionStatus = {
  connected: boolean
  email?: string
  connectedAt?: string
}

export async function getDriveConnectionStatus(): Promise<DriveConnectionStatus> {
  const creds = await loadCredentials()
  if (!creds) return { connected: false }
  return {
    connected: true,
    email: creds.email,
    connectedAt: creds.connectedAt,
  }
}

export async function getConnectDriveUrl(): Promise<{ url: string }> {
  const url = getAuthUrl()
  return { url }
}

export async function disconnectDrive(): Promise<{ success: boolean }> {
  try {
    const client = await getAuthorizedClient()
    if (client) {
      const creds = client.credentials
      if (creds.access_token) {
        await client.revokeToken(creds.access_token).catch(() => {})
      }
    }
  } catch {
    // best-effort revoke
  }
  await deleteCredentials()
  return { success: true }
}

function mimeToExt(mimeType: string): string {
  const map: Record<string, string> = {
    "application/vnd.google-apps.document": "docx",
    "application/vnd.google-apps.spreadsheet": "xlsx",
    "application/vnd.google-apps.presentation": "pptx",
  }
  return map[mimeType] ?? ""
}

function googleMimeToExportMime(mimeType: string): string | null {
  const map: Record<string, string> = {
    "application/vnd.google-apps.document":
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.google-apps.spreadsheet":
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.google-apps.presentation":
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  }
  return map[mimeType] ?? null
}

export async function listDriveFiles(folderPath: string = ""): Promise<FileItem[]> {
  const client = await getAuthorizedClient()
  if (!client) return []

  const drive = google.drive({ version: "v3", auth: client })

  // Determine parent folder ID
  let parentId = "root"
  if (folderPath) {
    const segments = folderPath.split("/").filter(Boolean)
    let currentId = "root"
    for (const segment of segments) {
      const res = await drive.files.list({
        q: `'${currentId}' in parents and name = '${segment.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
        fields: "files(id,name)",
        pageSize: 1,
      })
      const found = res.data.files?.[0]
      if (!found?.id) return []
      currentId = found.id
    }
    parentId = currentId
  }

  const res = await drive.files.list({
    q: `'${parentId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,size,modifiedTime,parents)",
    pageSize: 100,
    orderBy: "folder,name",
  })

  const files = res.data.files ?? []

  return files.map((f): FileItem => {
    const isDir = f.mimeType === "application/vnd.google-apps.folder"
    const isGoogleDoc = !!googleMimeToExportMime(f.mimeType ?? "")
    const ext = isGoogleDoc ? `.${mimeToExt(f.mimeType ?? "")}` : ""
    const displayName = isGoogleDoc ? `${f.name}${ext}` : (f.name ?? "")
    const itemPath = folderPath ? `${folderPath}/${f.name}` : (f.name ?? "")

    return {
      name: displayName,
      path: itemPath,
      isDirectory: isDir,
      size: parseInt(f.size ?? "0", 10) || 0,
      updatedAt: f.modifiedTime ?? new Date().toISOString(),
      source: "drive",
      driveFileId: f.id ?? undefined,
    }
  })
}

export type DriveFileMeta = {
  id: string
  name: string
  mimeType: string
  size: number
  exportMimeType: string | null
}

export async function getDriveFileMeta(fileId: string): Promise<DriveFileMeta | null> {
  const client = await getAuthorizedClient()
  if (!client) return null

  const drive = google.drive({ version: "v3", auth: client })
  const res = await drive.files.get({
    fileId,
    fields: "id,name,mimeType,size",
  })

  const f = res.data
  return {
    id: f.id ?? fileId,
    name: f.name ?? fileId,
    mimeType: f.mimeType ?? "application/octet-stream",
    size: parseInt(f.size ?? "0", 10) || 0,
    exportMimeType: googleMimeToExportMime(f.mimeType ?? ""),
  }
}

export async function getDriveDownloadStream(fileId: string): Promise<{
  stream: NodeJS.ReadableStream
  mimeType: string
  name: string
} | null> {
  const client = await getAuthorizedClient()
  if (!client) return null

  const drive = google.drive({ version: "v3", auth: client })
  const meta = await getDriveFileMeta(fileId)
  if (!meta) return null

  if (meta.exportMimeType) {
    const res = await drive.files.export(
      { fileId, mimeType: meta.exportMimeType },
      { responseType: "stream" }
    )
    return { stream: res.data as NodeJS.ReadableStream, mimeType: meta.exportMimeType, name: meta.name }
  }

  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  )
  return { stream: res.data as NodeJS.ReadableStream, mimeType: meta.mimeType, name: meta.name }
}