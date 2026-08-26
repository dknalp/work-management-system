"use client"

export const dynamic = "force-dynamic"

/**
 * Forgot password page — sends a Firebase password reset email directly.
 * No backend call needed; Firebase Auth handles the reset link delivery.
 */

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, BriefcaseIcon, CheckCircle2Icon, LoaderIcon } from "lucide-react"
import { sendPasswordResetEmail } from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      console.debug("[forgot-password] Sending reset email to:", email)
      await sendPasswordResetEmail(firebaseAuth, email)
      console.debug("[forgot-password] Reset email sent")
      setSent(true)
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? ""
      console.error("[forgot-password] sendPasswordResetEmail error:", code, err)
      if (code === "auth/user-not-found" || code === "auth/invalid-email") {
        // Don't reveal whether the email exists — just show success
        setSent(true)
        return
      }
      if (code === "auth/too-many-requests") {
        setError("Çok fazla istek gönderildi. Lütfen daha sonra tekrar deneyin.")
        return
      }
      if (code === "auth/network-request-failed") {
        setError("Ağ hatası. İnternet bağlantınızı kontrol edin.")
        return
      }
      setError("Sıfırlama e-postası gönderilemedi. Lütfen tekrar deneyin.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <BriefcaseIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Şifrenizi mi unuttunuz?</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            E-postanızı girin, sıfırlama bağlantısı gönderelim.
          </p>
        </div>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-800 dark:bg-emerald-950">
          <CheckCircle2Icon className="size-10 text-emerald-500" />
          <div>
            <p className="font-medium">Sıfırlama bağlantısı gönderildi</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {email} adresine bir e-posta gönderdik. Gelen kutunuzu kontrol edin.
            </p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Girişe dön
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <LoaderIcon className="mr-2 size-4 animate-spin" />}
            Sıfırlama Bağlantısı Gönder
          </Button>

          <Link href="/login">
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeftIcon className="size-4" />
              Girişe dön
            </Button>
          </Link>
        </form>
      )}
    </div>
  )
}