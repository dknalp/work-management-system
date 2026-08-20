"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { CheckCircle2Icon, ExternalLinkIcon, XCircleIcon, UnlinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getDriveConnectionStatus,
  getConnectDriveUrl,
  disconnectDrive,
  type DriveConnectionStatus,
} from "./admin-shared"

export function DriveSection() {
  const searchParams = useSearchParams()
  const [status, setStatus] = React.useState<DriveConnectionStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = React.useState(true)
  const [actionLoading, setActionLoading] = React.useState(false)
  const [banner, setBanner] = React.useState<{ type: "success" | "error"; msg: string } | null>(null)

  React.useEffect(() => {
    getDriveConnectionStatus().then((s) => { setStatus(s); setLoadingStatus(false) })
  }, [])

  React.useEffect(() => {
    if (searchParams.get("drive_connected") === "1") {
      setBanner({ type: "success", msg: "Google Drive başarıyla bağlandı." })
      getDriveConnectionStatus().then(setStatus)
    }
    const err = searchParams.get("drive_error")
    if (err) setBanner({ type: "error", msg: `Bağlantı hatası: ${err}` })
  }, [searchParams])

  async function handleConnect() {
    setActionLoading(true)
    try {
      const { url } = await getConnectDriveUrl()
      window.location.href = url
    } catch (e) {
      const msg = e instanceof Error && e.message.includes("GOOGLE_CLIENT_ID")
        ? "GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET tanımlanmamış. .env.local dosyasına ekleyin."
        : "Bağlantı kurulamadı. Lütfen tekrar deneyin."
      setBanner({ type: "error", msg })
      setActionLoading(false)
    }
  }

  async function handleDisconnect() {
    setActionLoading(true)
    const res = await disconnectDrive()
    if (res.success) {
      setStatus({ connected: false })
      setBanner({ type: "success", msg: "Google Drive bağlantısı kesildi." })
    }
    setActionLoading(false)
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex size-8 items-center justify-center rounded-lg bg-blue-500/10">
          <svg viewBox="0 0 24 24" className="size-4 text-blue-500" fill="currentColor">
            <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold">Google Drive Entegrasyonu</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Şirket Drive hesabını tüm çalışanlarla paylaşın</p>
        </div>
        <div className="ml-auto">
          {loadingStatus ? (
            <div className="size-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
          ) : status?.connected ? (
            <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-600 dark:text-green-400">
              <CheckCircle2Icon className="size-3.5" /> Bağlı
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <XCircleIcon className="size-3.5" /> Bağlı Değil
            </span>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {banner && (
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2.5 text-xs ${banner.type === "success" ? "bg-green-500/10 text-green-700 dark:text-green-300" : "bg-destructive/10 text-destructive"}`}>
            {banner.type === "success" ? <CheckCircle2Icon className="mt-0.5 size-3.5 shrink-0" /> : <XCircleIcon className="mt-0.5 size-3.5 shrink-0" />}
            <span>{banner.msg}</span>
            <button className="ml-auto" onClick={() => setBanner(null)}>✕</button>
          </div>
        )}

        {status?.connected ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hesap</span>
                <span className="font-medium">{status.email}</span>
              </div>
              {status.connectedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bağlantı tarihi</span>
                  <span className="text-muted-foreground">
                    {new Date(status.connectedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild>
                <a href="/files/drive" target="_blank" rel="noreferrer">
                  <ExternalLinkIcon className="size-3.5" /> Dosyaları Görüntüle
                </a>
              </Button>
              <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={handleDisconnect} disabled={actionLoading}>
                <UnlinkIcon className="size-3.5" />
                {actionLoading ? "Kesiliyor…" : "Bağlantıyı Kes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button className="gap-2" onClick={handleConnect} disabled={actionLoading}>
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                <path d="M6.28 3L1 12.95 6.28 21H17.72L23 12.95 17.72 3H6.28zM7.5 5h9l4.08 7H3.42L7.5 5zm-.78 9h10.56l-2.64 4.62H9.36L6.72 14z" />
              </svg>
              {actionLoading ? "Yönlendiriliyor…" : "Google hesabıyla bağlan"}
            </Button>
            <p className="text-xs text-muted-foreground">Google hesabınıza yönlendirileceksiniz.</p>
          </div>
        )}
      </div>
    </div>
  )
}