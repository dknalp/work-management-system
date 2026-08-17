"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { customizeFile } from "@/lib/actions/files"
import type { FileItem } from "@/components/files/file-utils"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface FolderCustomizeDialogProps {
  file: FileItem
  open: boolean
  onClose: () => void
  onUpdate: (updated: FileItem) => void
}

const COLOR_OPTIONS = [
  { value: "red", label: "Kırmızı", oklch: "oklch(0.628 0.258 29.23)" },
  { value: "blue", label: "Mavi", oklch: "oklch(0.588 0.243 264.05)" },
  { value: "green", label: "Yeşil", oklch: "oklch(0.608 0.196 145.56)" },
  { value: "yellow", label: "Sarı", oklch: "oklch(0.795 0.184 86.05)" },
  { value: "purple", label: "Mor", oklch: "oklch(0.558 0.288 302.32)" },
  { value: "orange", label: "Turuncu", oklch: "oklch(0.705 0.213 47.60)" },
  { value: "pink", label: "Pembe", oklch: "oklch(0.718 0.202 349.76)" },
  { value: "gray", label: "Gri", oklch: "oklch(0.556 0 0)" },
]

const EMOJI_OPTIONS = [
  "📁", "📂", "🗂️", "📋", "📌", "🔖", "💼", "🏠",
  "⭐", "🔥", "🚀", "💡", "🎯", "📊", "📈", "📉",
  "🗃️", "📦", "🔒", "🌟", "🎨", "🧩", "🔧", "📝",
  "🏆", "💎", "🌈", "🎵",
]

export function FolderCustomizeDialog({
  file,
  open,
  onClose,
  onUpdate,
}: FolderCustomizeDialogProps) {
  const [selectedColor, setSelectedColor] = useState<string>(file.color ?? "")
  const [selectedEmoji, setSelectedEmoji] = useState<string>(file.icon_emoji ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await customizeFile(file.id, {
        color: selectedColor || "",
        icon_emoji: selectedEmoji || "",
      })
      onUpdate({
        ...file,
        color: updated.color,
        icon_emoji: updated.icon_emoji,
      })
      toast.success("Özelleştirme kaydedildi")
      onClose()
    } catch {
      toast.error("Kaydetme başarısız")
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setSelectedColor("")
    setSelectedEmoji("")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {file.icon_emoji || (file.type === "folder" ? "📁" : "📄")}{" "}
            {file.name} — Özelleştir
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Color picker */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Renk
            </Label>
            <div className="flex flex-wrap gap-2">
              {/* Default / no color */}
              <button
                type="button"
                title="Varsayılan"
                onClick={() => setSelectedColor("")}
                className={cn(
                  "h-7 w-7 rounded-full border-2 bg-muted transition-all",
                  selectedColor === ""
                    ? "border-primary scale-110 ring-2 ring-primary/30"
                    : "border-transparent hover:border-muted-foreground"
                )}
              >
                <span className="sr-only">Varsayılan</span>
              </button>
              {COLOR_OPTIONS.map(({ value, label, oklch }) => (
                <button
                  key={value}
                  type="button"
                  title={label}
                  onClick={() => setSelectedColor(value)}
                  style={{ backgroundColor: oklch }}
                  className={cn(
                    "h-7 w-7 rounded-full border-2 transition-all",
                    selectedColor === value
                      ? "border-foreground scale-110 ring-2 ring-foreground/30"
                      : "border-transparent hover:scale-105"
                  )}
                >
                  <span className="sr-only">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Emoji picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Emoji İkon
              </Label>
              {selectedEmoji && (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setSelectedEmoji("")}
                >
                  Temizle
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setSelectedEmoji(emoji === selectedEmoji ? "" : emoji)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors",
                    selectedEmoji === emoji
                      ? "bg-primary/15 ring-1 ring-primary"
                      : "hover:bg-accent"
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {(selectedColor || selectedEmoji) && (
            <>
              <Separator />
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-3 py-2">
                <span className="text-2xl">
                  {selectedEmoji || (selectedColor
                    ? <span style={{ color: COLOR_OPTIONS.find(c => c.value === selectedColor)?.oklch }}>📁</span>
                    : "📁")}
                </span>
                <span className="text-sm text-muted-foreground truncate">{file.name}</span>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={handleReset}>
            Sıfırla
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            İptal
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}