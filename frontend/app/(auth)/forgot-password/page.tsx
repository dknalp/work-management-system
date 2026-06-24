"use client"

export const dynamic = "force-dynamic"

import React, { useState } from "react"
import Link from "next/link"
import { ArrowLeftIcon, BriefcaseIcon, CheckCircleIcon, LoaderIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { API_BASE_URL } from "@/lib/api"
import { MOCK_AUTH } from "@/contexts/auth-context"

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
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (!res.ok) throw new Error("Request failed")
      setSent(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <BriefcaseIcon className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reset password</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Enter your email and we&apos;ll send a reset link
          </p>
        </div>
      </div>

      {sent ? (
        <div className="space-y-4 text-center">
          <div className="flex justify-center">
            <CheckCircleIcon className="size-10 text-emerald-500" />
          </div>
          <div>
            <p className="font-medium">Check your terminal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              The reset link was printed to the backend console (mock mail mode).
            </p>
          </div>
          <Link href="/login">
            <Button variant="outline" className="w-full">
              Back to login
            </Button>
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            Send reset link
          </Button>

          <Link href="/login">
            <Button variant="ghost" className="w-full gap-2 text-muted-foreground">
              <ArrowLeftIcon className="size-4" />
              Back to login
            </Button>
          </Link>
        </form>
      )}
    </div>
  )
}