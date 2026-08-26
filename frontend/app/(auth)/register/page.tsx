"use client"

export const dynamic = "force-dynamic"

/**
 * Register page — creates a Firebase Auth account then POSTs to the backend
 * to create the Firestore user profile document.
 */

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { BriefcaseIcon, EyeIcon, EyeOffIcon, LoaderIcon } from "lucide-react"
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth"
import { firebaseAuth } from "@/lib/firebase"
import { tokenStorage } from "@/lib/auth"
import { API_BASE_URL } from "@/lib/api"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function RegisterPage() {
  const router = useRouter()
  const { updateUser } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1. Create Firebase Auth account
      console.debug("[register] Creating Firebase Auth account for:", email)
      let cred
      try {
        cred = await createUserWithEmailAndPassword(firebaseAuth, email, password)
      } catch (err: unknown) {
        const code = (err as { code?: string }).code ?? ""
        console.error("[register] Firebase account creation error:", code, err)
        if (code === "auth/email-already-in-use") throw new Error("Bu e-posta adresi zaten kullanımda.")
        if (code === "auth/weak-password") throw new Error("Şifre en az 6 karakter olmalıdır.")
        if (code === "auth/invalid-email") throw new Error("Geçersiz e-posta adresi.")
        if (code === "auth/network-request-failed") throw new Error("Ağ hatası. İnternet bağlantınızı kontrol edin.")
        throw new Error("Hesap oluşturulamadı. Lütfen tekrar deneyin.")
      }

      // 2. Set display name in Firebase Auth
      await updateProfile(cred.user, { displayName: name }).catch((err) => {
        console.warn("[register] Could not set display name:", err)
      })

      // 3. Get ID token and store it
      const idToken = await cred.user.getIdToken()
      tokenStorage.setToken(idToken)
      console.debug("[register] Firebase account created — creating backend profile")

      // 4. Create Firestore user profile via backend
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ name, email, password }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Profil oluşturulamadı" }))
        console.error("[register] Backend profile creation failed:", err)
        throw new Error(err.detail ?? "Profil oluşturulamadı")
      }

      const data = await res.json()
      console.debug("[register] Backend profile created:", data.user?.email)
      updateUser(data.user)
      router.replace("/home")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt başarısız oldu")
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
          <h1 className="text-xl font-semibold tracking-tight">Hesap oluştur</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Başlamak için aşağıdaki bilgileri doldurun.</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Ad Soyad</Label>
          <Input
            id="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Adınız Soyadınız"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

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

        <div className="space-y-2">
          <Label htmlFor="password">Şifre</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="Min. 8 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            >
              {showPassword ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
            </button>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <LoaderIcon className="mr-2 size-4 animate-spin" />}
          Hesap Oluştur
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Zaten hesabınız var mı?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Giriş yapın
          </Link>
        </p>
      </form>
    </div>
  )
}