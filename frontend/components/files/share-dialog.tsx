/**
 * ShareDialog — modal for sharing a file with other users or via a public link.
 *
 * Features:
 *  - Lists existing shares for the file (user shares and public link shares)
 *  - "Copy link" button: creates a public token share and copies the URL to clipboard
 *  - "Share with user" form: email/user-id input + permission level + optional expiry date
 *  - Revoke button per share record
 *
 * All API calls go through the typed helpers in @/lib/actions/files.
 */
"use client"

import * as React from "react"
import { format } from "date-fns"
import { toast } from "sonner"
import { CopyIcon, LinkIcon, TrashIcon, UserPlusIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

import {
  createShare,
  listShares,
  deleteShare,
  createShareLink,
  type FileShare,
} from "@/lib/actions/files"
import type { FileItem } from "./file-utils"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShareDialogProps {
  /** The file being shared. */
  file: FileItem
  /** Whether the dialog is open. */
  open: boolean
  /** Called when the dialog requests to be closed. */
  onClose: () => void
}

type PermissionLevel = "view" | "edit"

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ShareDialog — opens a modal allowing the user to share a file.
 * Shows existing shares and lets the user create new user shares or a public link.
 */
export function ShareDialog({ file, open, onClose }: ShareDialogProps) {
  // Existing share records for this file
  const [shares, setShares] = React.useState<FileShare[]>([])
  const [loading, setLoading] = React.useState(false)

  // "Share with user" form state
  const [userId, setUserId] = React.useState("")
  const [permission, setPermission] = React.useState<PermissionLevel>("view")
  const [expiresAt, setExpiresAt] = React.useState("")
  const [sharing, setSharing] = React.useState(false)

  // Public link generation state
  const [linkLoading, setLinkLoading] = React.useState(false)

  // Load shares whenever the dialog opens
  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    listShares(file.id)
      .then(setShares)
      .catch(() => toast.error("Paylaşımlar yüklenemedi"))
      .finally(() => setLoading(false))
  }, [open, file.id])

  // Reset form when dialog closes
  React.useEffect(() => {
    if (!open) {
      setUserId("")
      setPermission("view")
      setExpiresAt("")
    }
  }, [open])

  /** Generate a public link share and copy the URL to the clipboard. */
  async function handleCopyLink() {
    setLinkLoading(true)
    try {
      const { url } = await createShareLink(file.id)
      await navigator.clipboard.writeText(url)
      toast.success("Bağlantı panoya kopyalandı")
      // Refresh shares so the new link token appears in the list
      const updated = await listShares(file.id)
      setShares(updated)
    } catch {
      toast.error("Bağlantı oluşturulamadı")
    } finally {
      setLinkLoading(false)
    }
  }

  /** Share the file with a specific user. */
  async function handleShare(e: React.FormEvent) {
    e.preventDefault()
    const trimmedUserId = userId.trim()
    if (!trimmedUserId) {
      toast.error("Kullanıcı ID veya e-posta girin")
      return
    }
    setSharing(true)
    try {
      const newShare = await createShare(file.id, {
        shared_with_user_id: trimmedUserId,
        permission_level: permission,
        expires_at: expiresAt || undefined,
      })
      setShares((prev) => [...prev, newShare])
      setUserId("")
      setExpiresAt("")
      toast.success("Dosya paylaşıldı")
    } catch {
      toast.error("Paylaşım başarısız")
    } finally {
      setSharing(false)
    }
  }

  /** Revoke an existing share record. */
  async function handleRevoke(shareId: string) {
    try {
      await deleteShare(shareId)
      setShares((prev) => prev.filter((s) => s.id !== shareId))
      toast.success("Paylaşım iptal edildi")
    } catch {
      toast.error("Paylaşım iptal edilemedi")
    }
  }

  // Separate user-level shares from public link shares for display
  const userShares = shares.filter((s) => s.shared_with_user_id)
  const linkShares = shares.filter((s) => s.share_token && !s.shared_with_user_id)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 truncate">
            <UserPlusIcon className="size-4 shrink-0" />
            <span className="truncate">{file.name} — Paylaş</span>
          </DialogTitle>
          <DialogDescription>
            Bu dosyayı kullanıcılarla paylaşın veya herkese açık bir bağlantı oluşturun.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* ── Public link ────────────────────────────────────────────────── */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium">Herkese açık bağlantı</h3>
            <p className="text-xs text-muted-foreground">
              Bağlantıya sahip olan herkes dosyayı görüntüleyebilir.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleCopyLink}
              disabled={linkLoading}
            >
              {linkLoading ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <LinkIcon className="size-4" />
              )}
              Bağlantı oluştur ve kopyala
            </Button>

            {/* Show existing public link shares */}
            {linkShares.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {linkShares.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <CopyIcon className="size-3 shrink-0 text-muted-foreground" />
                      <span className="truncate font-mono text-muted-foreground">
                        {s.share_token}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.expires_at && (
                        <span className="text-muted-foreground">
                          {format(new Date(s.expires_at), "dd.MM.yyyy")}
                        </span>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 text-destructive hover:text-destructive"
                        onClick={() => handleRevoke(s.id)}
                        aria-label="Bağlantıyı iptal et"
                      >
                        <TrashIcon className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ── Share with specific user ────────────────────────────────────── */}
          <form onSubmit={handleShare} className="space-y-3">
            <h3 className="text-sm font-medium">Kullanıcıyla paylaş</h3>

            <div className="space-y-1.5">
              <Label htmlFor="share-user-id" className="text-xs">
                Kullanıcı ID veya e-posta
              </Label>
              <Input
                id="share-user-id"
                placeholder="user@example.com veya kullanıcı ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={sharing}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="share-permission" className="text-xs">
                  İzin
                </Label>
                <Select
                  value={permission}
                  onValueChange={(v) => setPermission(v as PermissionLevel)}
                  disabled={sharing}
                >
                  <SelectTrigger id="share-permission" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Görüntüle</SelectItem>
                    <SelectItem value="edit">Düzenle</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex-1 space-y-1.5">
                <Label htmlFor="share-expires" className="text-xs">
                  Son tarih (isteğe bağlı)
                </Label>
                <Input
                  id="share-expires"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  disabled={sharing}
                  className="h-8 text-sm"
                  min={format(new Date(), "yyyy-MM-dd")}
                />
              </div>
            </div>

            <Button
              type="submit"
              size="sm"
              className="w-full gap-2"
              disabled={sharing || !userId.trim()}
            >
              {sharing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <UserPlusIcon className="size-4" />
              )}
              Paylaş
            </Button>
          </form>

          {/* ── Existing user shares ─────────────────────────────────────────── */}
          {loading && (
            <div className="flex items-center justify-center py-4">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && userShares.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Mevcut paylaşımlar</h3>
                <ul className="space-y-1.5">
                  {userShares.map((s) => (
                    <li
                      key={s.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{s.shared_with_user_id}</p>
                        {s.expires_at && (
                          <p className="text-muted-foreground">
                            Bitiş: {format(new Date(s.expires_at), "dd.MM.yyyy")}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          {s.permission_level === "view" ? "Görüntüle" : "Düzenle"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6 text-destructive hover:text-destructive"
                          onClick={() => handleRevoke(s.id)}
                          aria-label="Paylaşımı iptal et"
                        >
                          <TrashIcon className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}