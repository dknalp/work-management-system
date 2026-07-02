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
import { CopyIcon, CheckIcon, TriangleAlertIcon } from "lucide-react"

type Props = {
  open: boolean
  onClose: () => void
  apiKey: string
  botName: string
}

export function ApiKeyRevealDialog({ open, onClose, apiKey, botName }: Props) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>API Key Oluşturuldu</DialogTitle>
          <DialogDescription>
            <strong>{botName}</strong> için API key aşağıda gösterilmektedir. Bu key bir daha gösterilmeyecektir.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
            <TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Bu key yalnızca şimdi görüntülenebilir. Güvenli bir yere kaydedin — pencereyi kapattıktan sonra kurtarılamaz.
            </p>
          </div>

          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">API Key</p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={apiKey}
                className="font-mono text-xs"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5">
                {copied ? <CheckIcon className="size-4 text-green-500" /> : <CopyIcon className="size-4" />}
                {copied ? "Kopyalandı" : "Kopyala"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>Anladım, kaydettim</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
