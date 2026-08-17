"use client"

import * as React from "react"
import { toast } from "sonner"
import { CopyIcon, LinkIcon, TrashIcon, UserPlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface ShareDialogProps {
  file: FileItem
  open: boolean
  onClose: () => void
}

export function ShareDialog({ file, open, onClose }: ShareDialogProps) {
  const [shares, setShares] = React.useState<FileShare[]>([])
  const [email, setEmail] = React.useState("")
  const [permission, setPermission] = React.useState<"view" | "edit">("view")
  const [publicLink, setPublicLink] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    listShares(file.id).then(setShares).catch(() => {})
  }, [open, file.id])

  const handleShare = async () => {
    if (!email.trim()) return
    setLoading(true)
    try {
      const share = await createShare(file.id, {
        shared_with_user_id: email.trim(),
        permission_level: permission,
      })
      setShares(prev => [...prev, share])
      setEmail("")
      toast.success("Paylaşıldı")
    } catch {
      toast.error("Paylaşım başarısız")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (shareId: string) => {
    try {
      await deleteShare(shareId)
      setShares(prev => prev.filter(s => s.id !== shareId))
      toast.success("Paylaşım kaldırıldı")
    } catch {
      toast.error("Kaldırma başarısız")
    }
  }

  const handleCreateLink = async () => {
    try {
      const { url } = await createShareLink(file.id)
      const fullUrl = `${window.location.origin}${url}`
      setPublicLink(fullUrl)
    } catch {
      toast.error("Link oluşturulamadı")
    }
  }

  const handleCopyLink = () => {
    if (!publicLink) return
    navigator.clipboard.writeText(publicLink)
    toast.success("Link kopyalandı")
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="truncate">&quot;{file.name}&quot; dosyasını paylaş</DialogTitle>
        </DialogHeader>

        {/* Kullanıcı ekle */}
        <div className="flex gap-2">
          <Input
            placeholder="E-posta adresi"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleShare()}
            className="flex-1"
          />
          <Select value={permission} onValueChange={(v) => setPermission(v as "view" | "edit")}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="view">Görüntüle</SelectItem>
              <SelectItem value="edit">Düzenle</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleShare} disabled={loading || !email.trim()} size="icon">
            <UserPlusIcon className="size-4" />
          </Button>
        </div>

        {/* Mevcut paylaşımlar */}
        {shares.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {shares.filter(s => s.shared_with_user_id).map(share => (
                <div key={share.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">{share.shared_with_user_id}</span>
                  <Badge variant="secondary" className="text-xs">{share.permission_level}</Badge>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => handleDelete(share.id)}>
                    <TrashIcon className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </>
        )}

        <Separator />

        {/* Public link */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Herkese açık link</p>
          {publicLink ? (
            <div className="flex gap-2">
              <Input value={publicLink} readOnly className="flex-1 text-xs" />
              <Button size="icon" variant="outline" onClick={handleCopyLink}>
                <CopyIcon className="size-4" />
              </Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={handleCreateLink}>
              <LinkIcon className="size-4 mr-2" />
              Link oluştur
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
