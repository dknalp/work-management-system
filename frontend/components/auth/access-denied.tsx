"use client"

import { useRouter } from "next/navigation"
import { ShieldOffIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function AccessDenied() {
  const router = useRouter()
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 text-center p-8">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted">
        <ShieldOffIcon className="size-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Erişim Reddedildi</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Bu sayfayı görüntülemek için gerekli izniniz bulunmuyor. Yöneticinizle iletişime geçin.
        </p>
      </div>
      <Button variant="outline" onClick={() => router.push("/dashboard")}>
        Dashboard&apos;a Dön
      </Button>
    </div>
  )
}