"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (name: string, description: string) => Promise<void>
  loading: boolean
}

export function CreateBotDialog({ open, onClose, onSubmit, loading }: Props) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await onSubmit(name.trim(), description.trim())
    setName("")
    setDescription("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yeni Bot Oluştur</DialogTitle>
          <DialogDescription>
            Bot oluşturulduktan sonra API key bir kez gösterilecektir. Güvenli bir yere kaydedin.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label htmlFor="bot-name">Bot Adı</Label>
            <Input
              id="bot-name"
              placeholder="Örn: CI/CD Bot"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={64}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bot-desc">Açıklama (isteğe bağlı)</Label>
            <Textarea
              id="bot-desc"
              placeholder="Bu botun ne yaptığını açıklayın..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={256}
              rows={3}
              className="resize-none"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>İptal</Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading ? "Oluşturuluyor…" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
