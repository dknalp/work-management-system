"use client"

import * as React from "react"
import { FolderIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface FileItem {
  id: string
  name: string
  path: string
  type: "file" | "folder"
  size?: number
  lastModified?: string
  mimeType?: string
  is_starred?: boolean
  isDriveFile?: boolean
  color?: string
  emoji?: string
}

// ---------------------------------------------------------------------------
// RenameDialog
// ---------------------------------------------------------------------------

interface RenameDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: string
  onChange: (value: string) => void
  onConfirm: () => void
}

export function RenameDialog({ open, onOpenChange, value, onChange, onConfirm }: RenameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Yeniden Adlandır</DialogTitle>
        </DialogHeader>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onConfirm()
            if (e.key === "Escape") onOpenChange(false)
          }}
          autoFocus
          className="mt-1"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={onConfirm} disabled={!value.trim()}>
            Yeniden Adlandır
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// DeleteDialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  onConfirm: () => void
}

export function DeleteDialog({ open, onOpenChange, count, onConfirm }: DeleteDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {count === 1 ? "Bu öğe çöp kutusuna taşınsın mı?" : `${count} öğe çöp kutusuna taşınsın mı?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Öğeler 7 gün sonra otomatik olarak kalıcı şekilde silinir.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Çöp Kutusuna Taşı
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ---------------------------------------------------------------------------
// MoveToDialog
// ---------------------------------------------------------------------------

interface MoveToDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: string
  onTargetChange: (target: string) => void
  folderChoices: { name: string; path: string }[]
  onConfirm: () => void
}

export function MoveToDialog({
  open,
  onOpenChange,
  target,
  onTargetChange,
  folderChoices,
  onConfirm,
}: MoveToDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Taşı</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Mevcut dizinde bir hedef klasör seçin:
          </p>
          {folderChoices.length === 0 ? (
            <p className="rounded-lg bg-muted/30 px-3 py-6 text-center text-xs text-muted-foreground">
              Burada klasör yok. Aşağıya bir yol yazın.
            </p>
          ) : (
            <div className="max-h-48 overflow-y-auto rounded-lg border border-border">
              {folderChoices.map((folder) => (
                <button
                  key={folder.path}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50",
                    target === folder.path && "bg-primary/10 text-primary"
                  )}
                  onClick={() => onTargetChange(folder.path)}
                >
                  <FolderIcon className="size-4 shrink-0 fill-blue-500/20 text-blue-500" />
                  {folder.name}
                </button>
              ))}
            </div>
          )}
          <Input
            placeholder="Veya bir yol yazın (örn. Belgeler/Projeler)"
            value={target}
            onChange={(e) => onTargetChange(e.target.value)}
            className="text-xs"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            İptal
          </Button>
          <Button onClick={onConfirm} disabled={!target.trim()}>
            Taşı
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}