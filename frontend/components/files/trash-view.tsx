"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Trash2Icon,
  RotateCcwIcon,
  FolderIcon,
  FileIcon,
  ArrowLeftIcon,
  AlertCircleIcon,
} from "lucide-react"
import { differenceInDays } from "date-fns"
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
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { formatSize } from "./file-utils"
import type { TrashItem } from "@/components/files/file-utils"
import { useTrash } from "@/hooks/use-trash"

function expiryLabel(expiresAt?: string): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: "", urgent: false }
  const days = differenceInDays(new Date(expiresAt), new Date())
  if (days <= 0) return { text: "Bugün silinecek", urgent: true }
  if (days === 1) return { text: "Yarın silinecek", urgent: true }
  if (days <= 3) return { text: `${days} gün kaldı`, urgent: true }
  return { text: `${days} gün kaldı`, urgent: false }
}

export function TrashView() {
  const router = useRouter()
  const { items, isLoading, error, refresh, restore, permanentDelete, emptyTrash } = useTrash()
  const [emptyConfirmOpen, setEmptyConfirmOpen] = React.useState(false)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = React.useState<TrashItem | null>(null)

  // Re-fetch when external changes happen (e.g. file trashed from explorer)
  React.useEffect(() => {
    const handler = () => refresh()
    window.addEventListener("wms:files:changed", handler)
    return () => window.removeEventListener("wms:files:changed", handler)
  }, [refresh])

  const handleRestore = async (item: TrashItem) => {
    await restore(item.id)
    window.dispatchEvent(new Event("wms:files:changed"))
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    setPermanentDeleteTarget(null)
    await permanentDelete(item.id)
  }

  const handleEmptyTrash = async () => {
    setEmptyConfirmOpen(false)
    await emptyTrash()
    window.dispatchEvent(new Event("wms:files:changed"))
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-1.5 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push("/files")}
          >
            <ArrowLeftIcon className="size-3.5" />
            Dosyalara Dön
          </Button>
          <span className="text-muted-foreground/40 text-xs">·</span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Trash2Icon className="size-3.5" />
            <span>Çöp Kutusu</span>
            {items.length > 0 && (
              <span className="text-muted-foreground/60">({items.length})</span>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setEmptyConfirmOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
            Boşalt
          </Button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 mx-4 mt-3 px-3 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircleIcon className="size-4 shrink-0" />
          <span>{error}</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
            onClick={refresh}
          >
            Tekrar dene
          </Button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <Trash2Icon className="size-10 opacity-20" />
            <p className="text-sm">Çöp kutusu boş</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50">
            {items.map((item) => {
              const expiry = expiryLabel(item.expiresAt)
              return (
                <li
                  key={item.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 group"
                >
                  {item.type === "folder" ? (
                    <FolderIcon className="size-4 shrink-0 text-amber-500" />
                  ) : (
                    <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {item.size != null && <span>{formatSize(item.size)}</span>}
                      {item.originalPath && (
                        <span className="truncate opacity-60">{item.originalPath}</span>
                      )}
                      {expiry.text && (
                        <span className={cn("font-medium", expiry.urgent && "text-destructive")}>
                          {expiry.text}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={() => handleRestore(item)}
                    >
                      <RotateCcwIcon className="size-3.5" />
                      Geri Yükle
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setPermanentDeleteTarget(item)}
                    >
                      <Trash2Icon className="size-3.5" />
                      Kalıcı Sil
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Empty trash confirm */}
      <AlertDialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çöp kutusu kalıcı olarak boşaltılsın mı?</AlertDialogTitle>
            <AlertDialogDescription>
              {items.length} öğe kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleEmptyTrash}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Boşalt
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Permanent delete confirm */}
      <AlertDialog
        open={!!permanentDeleteTarget}
        onOpenChange={(v) => { if (!v) setPermanentDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalıcı olarak silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              "{permanentDeleteTarget?.name}" kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteTarget && handlePermanentDelete(permanentDeleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Kalıcı Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
