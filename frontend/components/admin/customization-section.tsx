"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SlidersHorizontalIcon, PlusIcon, Trash2Icon, ExternalLinkIcon } from "lucide-react"
import { toast } from "sonner"
import {
  getCustomNavLinks,
  addCustomNavLink,
  removeCustomNavLink,
  type CustomNavLink,
} from "@/lib/custom-nav"
import { getAllRoles, ROLE_LABELS } from "./admin-shared"

export function CustomizationSection() {
  const [links, setLinks] = React.useState<CustomNavLink[]>([])
  const [addOpen, setAddOpen] = React.useState(false)
  const [form, setForm] = React.useState({ title: "", url: "", roles: "all" })
  const allRoles = React.useMemo(() => getAllRoles(), [])

  React.useEffect(() => {
    setLinks(getCustomNavLinks())
  }, [])

  const handleAdd = () => {
    if (!form.title.trim() || !form.url.trim()) return
    const rolesValue: "all" | string[] = form.roles === "all" ? "all" : [form.roles]
    const updated = addCustomNavLink({ title: form.title.trim(), url: form.url.trim(), roles: rolesValue })
    setLinks(updated)
    setForm({ title: "", url: "", roles: "all" })
    setAddOpen(false)
    toast.success("Yönlendirme eklendi.")
  }

  const handleRemove = (id: string) => {
    const updated = removeCustomNavLink(id)
    setLinks(updated)
    toast.success("Yönlendirme silindi.")
  }

  const rolesLabel = (link: CustomNavLink) => {
    if (link.roles === "all") return "Hepsi"
    return Array.isArray(link.roles) ? link.roles.map((r) => ROLE_LABELS[r] ?? r).join(", ") : link.roles
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Özelleştirme</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Çalışma alanı görünümünü ve navigasyonu özelleştirin.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <SlidersHorizontalIcon className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Yan Çubuk Ayarları</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Yan çubuğa özel gezinme bağlantıları ekleyin
              </p>
            </div>
          </div>
          <Button size="sm" className="gap-1.5 text-xs" onClick={() => setAddOpen((v) => !v)}>
            <PlusIcon className="size-3.5" /> Yönlendirme Ekle
          </Button>
        </div>

        {addOpen && (
          <div className="border-b border-border/60 bg-muted/20 px-5 py-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Yeni Yönlendirme
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="nav-title">Başlık</Label>
                <Input
                  id="nav-title"
                  placeholder="Örn. Notion"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nav-url">Bağlantı URL</Label>
                <Input
                  id="nav-url"
                  placeholder="https://notion.so/..."
                  value={form.url}
                  onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") handleAdd() }}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Görünür Roller</Label>
              <Select value={form.roles} onValueChange={(v) => setForm((f) => ({ ...f, roles: v }))}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Rol seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Hepsi</SelectItem>
                  {allRoles.map((r) => (
                    <SelectItem key={r.name} value={r.name}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!form.title.trim() || !form.url.trim()}>
                Ekle
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAddOpen(false)}>İptal</Button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border/40">
          {links.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              Henüz özel yönlendirme yok.
            </p>
          ) : (
            links.map((link) => (
              <div key={link.id} className="flex items-center gap-3 px-5 py-3">
                <ExternalLinkIcon className="size-4 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{link.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{link.url}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {rolesLabel(link)}
                </span>
                <button
                  onClick={() => handleRemove(link.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="Sil"
                >
                  <Trash2Icon className="size-4" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}