"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  listTrash,
  restoreFile,
  deleteFilePermanent,
  emptyTrash as emptyTrashApi,
} from "@/lib/actions/files"
import { fileRecordToTrashItem } from "@/components/files/file-utils"
import type { TrashItem } from "@/components/files/file-utils"

interface UseTrashReturn {
  items: TrashItem[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  restore: (id: string) => Promise<void>
  permanentDelete: (id: string) => Promise<void>
  emptyTrash: () => Promise<void>
}

/**
 * Centralises all trash state and API calls.
 * Provides optimistic updates: items are removed from the list immediately
 * on restore/delete and rolled back if the API call fails.
 */
export function useTrash(): UseTrashReturn {
  const [items, setItems] = React.useState<TrashItem[]>([])
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const refresh = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const records = await listTrash()
      setItems(records.map(fileRecordToTrashItem))
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load trash"
      setError(msg)
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const restore = React.useCallback(async (id: string) => {
    // Optimistic: remove from list immediately
    const snapshot = items
    setItems(prev => prev.filter(i => i.id !== id))
    setError(null)
    try {
      await restoreFile(id)
      toast.success("File restored")
      // Refresh to get accurate ground-truth state
      const records = await listTrash()
      setItems(records.map(fileRecordToTrashItem))
    } catch (err) {
      // Rollback
      setItems(snapshot)
      const msg = err instanceof Error ? err.message : "Failed to restore file"
      setError(msg)
      toast.error(msg)
    }
  }, [items])

  const permanentDelete = React.useCallback(async (id: string) => {
    // Optimistic: remove from list immediately
    const snapshot = items
    setItems(prev => prev.filter(i => i.id !== id))
    setError(null)
    try {
      await deleteFilePermanent(id)
      toast.success("File permanently deleted")
    } catch (err) {
      // Rollback
      setItems(snapshot)
      const msg = err instanceof Error ? err.message : "Failed to delete file"
      setError(msg)
      toast.error(msg)
    }
  }, [items])

  const emptyTrash = React.useCallback(async () => {
    const snapshot = items
    setItems([])
    setError(null)
    try {
      await emptyTrashApi()
      toast.success("Trash emptied")
    } catch (err) {
      // Rollback
      setItems(snapshot)
      const msg = err instanceof Error ? err.message : "Failed to empty trash"
      setError(msg)
      toast.error(msg)
    }
  }, [items])

  // Load on mount
  React.useEffect(() => {
    refresh()
  }, [refresh])

  return { items, isLoading, error, refresh, restore, permanentDelete, emptyTrash }
}
