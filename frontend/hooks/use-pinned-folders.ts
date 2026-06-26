"use client"

import { useEffect, useState, useCallback } from "react"

const STORAGE_KEY = "wms:files:pinned"
const STORAGE_EVENT = "wms:files:pinned:change"

export interface PinnedFolder {
  name: string
  path: string
}

function readPinned(): PinnedFolder[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writePinned(folders: PinnedFolder[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(folders))
  window.dispatchEvent(new Event(STORAGE_EVENT))
}

export function usePinnedFolders() {
  const [pinned, setPinned] = useState<PinnedFolder[]>(() => readPinned())

  useEffect(() => {
    const onUpdate = () => setPinned(readPinned())
    window.addEventListener(STORAGE_EVENT, onUpdate)
    window.addEventListener("storage", onUpdate)
    return () => {
      window.removeEventListener(STORAGE_EVENT, onUpdate)
      window.removeEventListener("storage", onUpdate)
    }
  }, [])

  const pin = useCallback((folder: PinnedFolder) => {
    const current = readPinned()
    if (current.some((f) => f.path === folder.path)) return
    writePinned([...current, folder])
  }, [])

  const unpin = useCallback((path: string) => {
    const current = readPinned()
    writePinned(current.filter((f) => f.path !== path))
  }, [])

  const isPinned = useCallback(
    (path: string) => pinned.some((f) => f.path === path),
    [pinned]
  )

  return { pinned, pin, unpin, isPinned }
}