"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react"
import { toast } from "sonner"
import { CreateBotDialog } from "@/components/admin/create-bot-dialog"
import { ApiKeyRevealDialog } from "@/components/admin/api-key-reveal-dialog"
import {
  listBots,
  createBot,
  updateBot,
  deleteBot,
  regenerateBotKey,
  type Bot,
} from "./admin-shared"

export function BotsSection() {
  const [bots, setBots] = React.useState<Bot[]>([])
  const [loading, setLoading] = React.useState(true)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [creating, setCreating] = React.useState(false)
  const [revealKey, setRevealKey] = React.useState<string | null>(null)
  const [revealBotName, setRevealBotName] = React.useState("")

  React.useEffect(() => {
    listBots()
      .then(setBots)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = async (name: string, description?: string) => {
    setCreating(true)
    try {
      const result = await createBot(name, description)
      setBots((prev) => [result, ...prev])
      setCreateOpen(false)
      setRevealBotName(result.name)
      setRevealKey(result.api_key ?? null)
      toast.success(`"${result.name}" botu oluşturuldu.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bot oluşturulamadı.")
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (bot: Bot) => {
    const next = !bot.is_active
    setBots((prev) => prev.map((b) => (b.id === bot.id ? { ...b, is_active: next } : b)))
    try {
      await updateBot(bot.id, { is_active: next })
      toast.success(next ? `"${bot.name}" etkinleştirildi.` : `"${bot.name}" devre dışı bırakıldı.`)
    } catch {
      setBots((prev) => prev.map((b) => (b.id === bot.id ? bot : b)))
      toast.error("Durum güncellenemedi.")
    }
  }

  const handleDelete = async (bot: Bot) => {
    setBots((prev) => prev.filter((b) => b.id !== bot.id))
    try {
      await deleteBot(bot.id)
      toast.success(`"${bot.name}" silindi.`)
    } catch {
      setBots((prev) => [bot, ...prev])
      toast.error("Bot silinemedi.")
    }
  }

  const handleRegenerate = async (bot: Bot) => {
    try {
      const result = await regenerateBotKey(bot.id)
      setRevealBotName(bot.name)
      setRevealKey(result.api_key)
      toast.success("Yeni API anahtarı oluşturuldu.")
    } catch {
      toast.error("Anahtar yenilenemedi.")
    }
  }

  return (
    <>
      <CreateBotDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        loading={creating}
      />
      <ApiKeyRevealDialog
        open={!!revealKey}
        onClose={() => setRevealKey(null)}
        apiKey={revealKey ?? ""}
        botName={revealBotName}
      />

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold">Bot Hesapları</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{bots.length} bot</p>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setCreateOpen(true)}>
            <PlusIcon className="size-3.5" /> Yeni Bot
          </Button>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Yükleniyor…</div>
          ) : bots.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">Henüz bot yok</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-xs text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-medium">Bot</th>
                  <th className="px-5 py-2.5 text-left font-medium">API Prefix</th>
                  <th className="px-5 py-2.5 text-left font-medium">Son Kullanım</th>
                  <th className="px-5 py-2.5 text-left font-medium">Aktif</th>
                  <th className="px-5 py-2.5 text-right font-medium">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {bots.map((bot) => (
                  <tr key={bot.id} className="hover:bg-muted/30">
                    <td className="px-5 py-3">
                      <p className="font-medium">{bot.name}</p>
                      {bot.description && (
                        <p className="text-xs text-muted-foreground">{bot.description}</p>
                      )}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                      {bot.key_prefix}…
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {bot.last_used_at
                        ? new Date(bot.last_used_at).toLocaleDateString("tr-TR")
                        : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Switch
                        checked={bot.is_active}
                        onCheckedChange={() => handleToggleActive(bot)}
                      />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm" variant="outline"
                          className="h-7 gap-1.5 px-2 text-xs"
                          onClick={() => handleRegenerate(bot)}
                          title="Anahtarı Yenile"
                        >
                          <RefreshCwIcon className="size-3" /> Yenile
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleDelete(bot)}
                          title="Sil"
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  )
}