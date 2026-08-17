"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon, RotateCcwIcon, Trash, XIcon, FolderIcon, FileIcon } from "lucide-react"
import { formatDistanceToNow, differenceInDays } from "date-fns"
import { tr } from "date-fns/locale"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

interface TrashDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function expiryLabel(expiresAt?: string): { text: string; urgent: boolean } {
  if (!expiresAt) return { text: "", urgent: false }
  const days = differenceInDays(new Date(expiresAt), new Date())
  if (days <= 0) return { text: "Bugün silinecek", urgent: true }
  if (days === 1) return { text: "Yarın silinecek", urgent: true }
  if (days <= 3) return { text: `${days} gün kaldı`, urgent: true }
  return { text: `${days} gün kaldı`, urgent: false }
}

export function TrashDialog({ open, onOpenChange }: TrashDialogProps) {
  const router = useRouter()
  const [items, setItems] = React.useState<TrashItem[]>([])
  const [loading, setLoading] = React.useState(false)
  const [emptyConfirmOpen, setEmptyConfirmOpen] = React.useState(false)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = React.useState<TrashItem | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const records = await listFiles("", true /* showTrash */)
      setItems(records.map(fileRecordToTrashItem))
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) load()
  }, [open, load])

  const handleRestore = async (item: TrashItem) => {
    try {
      await restoreFile(item.id)
      toast.success(`"${item.originalName}" geri yüklendi`)
      router.refresh()
      load()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Geri yükleme başarısız")
    }
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    setPermanentDeleteTarget(null)
    try {
      await deleteFilePermanent(item.id)
      toast.success(`"${item.originalName}" kalıcı olarak silindi`)
      load()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Silme başarısız")
    }
  }

  const handleEmptyTrash = async () => {
    setEmptyConfirmOpen(false)
    try {
      const res = await emptyTrash()
      toast.success(`Çöp kutusu boşaltıldı (${res.deleted_count} öğe)`)
      setItems([])
      router.refresh()
    } catch (err: unknown) {
      toast.error((err as Error).message ?? "Boşaltma başarısız")
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2Icon className="size-4" />
              Çöp Kutusu
              {items.length > 0 && (
                <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs font-normal text-muted-foreground">
                  {items.length}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Trash className="size-10 opacity-20" />
              <p className="text-sm">Çöp kutusu boş</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Öğeler 30 gün sonra otomatik olarak kalıcı şekilde silinir.
              </p>
              <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                {items.map((item) => {
                  const expiry = expiryLabel(item.expiresAt)
                  return (
                    <div
                      key={item.id}
                      className="group flex items-center gap-3 border-b border-border/50 px-4 py-2.5 last:border-0 hover:bg-muted/30"
                    >
                      {item.type === "folder" ? (
                        <FolderIcon className="size-4 shrink-0 fill-blue-500/20 text-blue-500" />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-sm">{item.originalName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {item.deletedAt
                            ? formatDistanceToNow(new Date(item.deletedAt), { addSuffix: true, locale: tr }) + " silindi"
                            : "silindi"}
                          {item.type !== "folder" && item.size ? ` · ${formatSize(item.size)}` : ""}
                          {expiry.text && (
                            <>
                              {" · "}
                              <span className={cn(expiry.urgent ? "text-amber-500" : "text-muted-foreground")}>
                                {expiry.text}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1.5 text-xs"
                          onClick={() => handleRestore(item)}
                          title="Geri yükle"
                        >
                          <RotateCcwIcon className="size-3" />
                          Geri Yükle
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setPermanentDeleteTarget(item)}
                          title="Kalıcı olarak sil"
                        >
                          <XIcon className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end">
                <Button
                  variant="destructive"
                  size="sm"
                  className="gap-2"
                  onClick={() => setEmptyConfirmOpen(true)}
                >
                  <Trash2Icon className="size-3.5" />
                  Çöp Kutusunu Boşalt
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirm */}
      <AlertDialog
        open={permanentDeleteTarget !== null}
        onOpenChange={(o) => { if (!o) setPermanentDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              &quot;{permanentDeleteTarget?.originalName}&quot; kalıcı olarak silinsin mi?
            </AlertDialogTitle>
            <AlertDialogDescription>Bu işlem geri alınamaz.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => permanentDeleteTarget && handlePermanentDelete(permanentDeleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Kalıcı Olarak Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  )
}