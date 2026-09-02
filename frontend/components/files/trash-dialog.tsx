"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  Trash2Icon,
  RotateCcwIcon,
  Trash,
  FolderIcon,
  FileIcon,
  AlertCircleIcon,
} from "lucide-react"
import { differenceInDays } from "date-fns"
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
import { cn } from "@/lib/utils"
import { formatSize } from "./file-utils"
import type { TrashItem } from "@/components/files/file-utils"
import { useTrash } from "@/hooks/use-trash"

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
  const { items, isLoading, error, refresh, restore, permanentDelete, emptyTrash } = useTrash()
  const [emptyConfirmOpen, setEmptyConfirmOpen] = React.useState(false)
  const [permanentDeleteTarget, setPermanentDeleteTarget] = React.useState<TrashItem | null>(null)

  // Refresh when dialog opens
  React.useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  const handleRestore = async (item: TrashItem) => {
    await restore(item.id)
    router.refresh()
  }

  const handlePermanentDelete = async (item: TrashItem) => {
    setPermanentDeleteTarget(null)
    await permanentDelete(item.id)
  }

  const handleEmptyTrash = async () => {
    setEmptyConfirmOpen(false)
    await emptyTrash()
    router.refresh()
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

          {/* Error banner */}
          {error && (
            <div className="flex items-center gap-2 px-1 py-2 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircleIcon className="size-4 shrink-0" />
              <span className="flex-1">{error}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-destructive hover:bg-destructive/10"
                onClick={refresh}
              >
                Tekrar dene
              </Button>
            </div>
          )}

          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-muted-foreground">
              <Trash className="size-10 opacity-20" />
              <p className="text-sm">Çöp kutusu boş</p>
            </div>
          ) : (
            <>
              <ul className="max-h-72 divide-y divide-border/50 overflow-y-auto rounded-md border border-border/50">
                {items.map((item) => {
                  const expiry = expiryLabel(item.expiresAt)
                  return (
                    <li key={item.id} className="flex items-center gap-3 px-3 py-2 group hover:bg-muted/40">
                      {item.type === "folder" ? (
                        <FolderIcon className="size-4 shrink-0 text-amber-500" />
                      ) : (
                        <FileIcon className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium">{item.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {item.size != null && <span>{formatSize(item.size)}</span>}
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
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          title="Geri Yükle"
                          onClick={() => handleRestore(item)}
                        >
                          <RotateCcwIcon className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Kalıcı Sil"
                          onClick={() => setPermanentDeleteTarget(item)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>

              <div className="flex justify-end pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setEmptyConfirmOpen(true)}
                >
                  <Trash2Icon className="size-3.5" />
                  Tümünü Kalıcı Sil ({items.length})
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Permanent delete single item */}
      <AlertDialog
        open={!!permanentDeleteTarget}
        onOpenChange={(v) => { if (!v) setPermanentDeleteTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kalıcı olarak silinsin mi?</AlertDialogTitle>
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
