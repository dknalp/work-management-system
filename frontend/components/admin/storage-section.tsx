"use client"

import * as React from "react"
import { HardDriveIcon, InfoIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { getStorageConfig, updateStoragePath } from "./admin-shared"

export function StorageSection() {
  const [storagePath, setStoragePath] = React.useState("")
  const [source, setSource] = React.useState<"env" | "config" | "default">("default")
  const [pathInput, setPathInput] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    getStorageConfig().then(({ path, source }) => {
      setStoragePath(path)
      setSource(source)
      setPathInput(path)
    })
  }, [])

  const handleSave = async () => {
    if (!pathInput.trim()) return
    setSaving(true)
    const res = await updateStoragePath(pathInput.trim())
    if (res.success) {
      setStoragePath(res.path ?? pathInput.trim())
      setSource("config")
      toast.success("Depolama yolu güncellendi")
    } else {
      toast.error(res.error ?? "Failed to update storage path")
    }
    setSaving(false)
  }

  const sourceLabel = {
    env: { text: "Ortam Değişkeni", color: "text-violet-500 bg-violet-500/10" },
    config: { text: "Özel Yapılandırma", color: "text-emerald-500 bg-emerald-500/10" },
    default: { text: "Varsayılan", color: "text-muted-foreground bg-muted/60" },
  }[source]

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <HardDriveIcon className="size-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">Depolama Yapılandırması</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Dosyaların diskte saklandığı yer. Paylaşılan bir ağ sürücüsüne yönlendirmek için değiştirin.
          </p>
        </div>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${sourceLabel.color}`}>
          {sourceLabel.text}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="mb-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">Mevcut Yol</p>
          <p className="rounded-lg bg-muted/40 px-3 py-2 font-mono text-sm break-all">{storagePath || "Yükleniyor…"}</p>
        </div>

        {source === "env" ? (
          <div className="flex items-start gap-2 rounded-lg bg-violet-500/5 border border-violet-500/20 px-3 py-2.5">
            <InfoIcon className="mt-0.5 size-4 shrink-0 text-violet-500" />
            <p className="text-xs text-muted-foreground">
              Yol, <code className="font-mono text-xs text-violet-500">FILE_STORAGE_PATH</code> ortam değişkeni tarafından kontrol edilmektedir ve buradan değiştirilemez.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Özel Yol Ayarla</p>
            <div className="flex gap-2">
              <Input
                placeholder="/absolute/path/to/storage"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave() }}
                className="font-mono text-sm"
              />
              <Button onClick={handleSave} disabled={saving || !pathInput.trim() || pathInput === storagePath} size="sm" className="shrink-0">
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </Button>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-muted/30 border border-border/40 px-3 py-2.5">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Çok sunuculu kurulumlar için <code className="font-mono text-xs">FILE_STORAGE_PATH</code> ortam değişkenini kullanın.
              </p>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/20 px-3 py-2.5">
              <InfoIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-amber-600 dark:text-amber-400">Container uyarısı:</span>{" "}
                Bu yapılandırma <code className="font-mono text-xs">config/storage.json</code> dosyasına kaydedilir ve container yeniden başlatıldığında sıfırlanır.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}