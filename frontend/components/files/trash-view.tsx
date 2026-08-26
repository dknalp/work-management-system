"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Trash2Icon,
  RotateCcwIcon,
  FolderIcon,
  FileIcon,
  ArrowLeftIcon,
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
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatSize } from "./file-utils"
import type { TrashItem } from "@/components/files/file-utils"
import {
  listFiles,
  restoreFile,
  deleteFilePermanent,
  emptyTrash,
} from "@/lib/actions/files"
import { fileRecordToTrashItem } from "./file-utils"

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
  const [items, setItems] = React.useState<TrashItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [emptyConfirmOpen, setEmptyConfirmOpen] = React.useState(false)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = React.useState<TrashItem | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const records = await listFiles("", true)
      setItems(records.map(fileRecordToTrashItem))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  // Re-fetch when external changes happen (e.g. trash from explorer)
  React.useEffect(() => {
    const handler = () => load()
    window.addEventListener("wms:files:changed", handler)
    return () => window.removeEventListener("wms:files:changed", handler)
  }, [load])

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreFile(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success(`"${item.name}" geri yüklendi`)
      window.dispatchEvent(new Event("wms:files:changed"))
    } catch {
      toast.error("Geri yükleme başarısız")
    }
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    try {
      await deleteFilePermanent(item.id)
      setItems((prev) => prev.filter((i) => i.id !== item.id))
      toast.success(`"${item.name}" kalıcı olarak silindi`)
    } catch {
      toast.error("Silme başarısız")
    } finally {
      setPermanentDeleteTarget(null)
    }
  }

  const handleEmptyTrash = async () => {
    try {
      await emptyTrash()
      setItems([])
      toast.success("Çöp kutusu boşaltıldı")
      window.dispatchEvent(new Event("wms:files:changed"))
    } catch {
      toast.error("Çöp kutusu boşaltılamadı")
    } finally {
      setEmptyConfirmOpen(false)
    }
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
            className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setEmptyConfirmOpen(true)}
          >
            <Trash2Icon className="size-3.5" />
            Çöp Kutusunu Boşalt
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-muted-foreground">
            <Trash2Icon className="size-12 opacity-10" />
            <p className="text-sm">Çöp kutusu boş</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <div className="px-4 py-2.5 border-b border-border bg-muted/30">
              <p className="text-[10px] font-bold tracking-widest text-muted-foreground/60 uppercase">
                Silinen Dosyalar
              </p>
            </div>
            <ul className="divide-y divide-border/50">
              {items.map((item) => {
                const expiry = expiryLabel(item.expiresAt)
                return (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="shrink-0 text-muted-foreground">
                      {item.type === "folder" ? (
                        <FolderIcon className="size-5" />
                      ) : (
                        <FileIcon className="size-5" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {item.path && (
                          <span className="text-[11px] text-muted-foreground/60 truncate">
                            {item.path}
                          </span>
                        )}
                        {item.size != null && item.type !== "folder" && (
                          <span className="text-[11px] text-muted-foreground/50 shrink-0">
                            · {formatSize(item.size)}
                          </span>
                        )}
                        {expiry.text && (
                          <span
                            className={cn(
                              "text-[11px] shrink-0",
                              expiry.urgent ? "text-destructive" : "text-muted-foreground/50"
                            )}
                          >
                            · {expiry.text}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
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
                        className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
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
          </div>
        )}
      </div>

      {/* Empty trash confirm */}
      <AlertDialog open={emptyConfirmOpen} onOpenChange={setEmptyConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Çöp kutusu boşaltılsın mı?</AlertDialogTitle>
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