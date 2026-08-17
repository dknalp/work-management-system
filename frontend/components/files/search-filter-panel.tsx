"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import type { SearchFilters } from "@/lib/actions/files"
import {
  Image,
  Video,
  Music,
  FileText,
  Table,
  Code2,
  Archive,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface SearchFilterPanelProps {
  filters: SearchFilters
  onChange: (filters: SearchFilters) => void
  onClear: () => void
}

const MIME_CATEGORIES = [
  { value: "image", label: "Görsel", icon: Image },
  { value: "video", label: "Video", icon: Video },
  { value: "audio", label: "Ses", icon: Music },
  { value: "document", label: "Belge", icon: FileText },
  { value: "spreadsheet", label: "Tablo", icon: Table },
  { value: "code", label: "Kod", icon: Code2 },
  { value: "archive", label: "Arşiv", icon: Archive },
] as const

type MimeCategory = (typeof MIME_CATEGORIES)[number]["value"]

const DATE_PRESETS = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu hafta" },
  { value: "month", label: "Bu ay" },
  { value: "custom", label: "Özel" },
] as const

type DatePreset = (typeof DATE_PRESETS)[number]["value"]

const SIZE_PRESETS = [
  { value: "small", label: "Küçük (<1MB)", min: 0, max: 1_000_000 },
  { value: "medium", label: "Orta (1–50MB)", min: 1_000_000, max: 50_000_000 },
  { value: "large", label: "Büyük (>50MB)", min: 50_000_000, max: undefined },
] as const

type SizePreset = (typeof SIZE_PRESETS)[number]["value"]

function getDateRange(preset: DatePreset): { dateFrom?: string; dateTo?: string } {
  const now = new Date()
  if (preset === "today") {
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() }
  }
  if (preset === "week") {
    const start = new Date(now)
    start.setDate(now.getDate() - now.getDay())
    start.setHours(0, 0, 0, 0)
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() }
  }
  if (preset === "month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    return { dateFrom: start.toISOString(), dateTo: now.toISOString() }
  }
  return {}
}

function getSizeRange(preset: SizePreset): { minSize?: number; maxSize?: number } {
  const found = SIZE_PRESETS.find((p) => p.value === preset)
  if (!found) return {}
  return { minSize: found.min, maxSize: found.max }
}

export function SearchFilterPanel({ filters, onChange, onClear }: SearchFilterPanelProps) {
  const [datePreset, setDatePreset] = useState<DatePreset | "">("")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")
  const [sizePreset, setSizePreset] = useState<SizePreset | "">("")

  const hasFilters =
    !!filters.type ||
    !!filters.mimeCategory ||
    filters.minSize !== undefined ||
    filters.maxSize !== undefined ||
    !!filters.dateFrom ||
    !!filters.dateTo ||
    filters.isStarred !== undefined

  function handleTypeChange(value: "all" | "file" | "folder") {
    if (value === "all") {
      const { type: _t, ...rest } = filters
      onChange(rest)
    } else {
      onChange({ ...filters, type: value })
    }
  }

  function handleMimeCategoryToggle(cat: MimeCategory) {
    if (filters.mimeCategory === cat) {
      const { mimeCategory: _m, ...rest } = filters
      onChange(rest)
    } else {
      onChange({ ...filters, mimeCategory: cat })
    }
  }

  function handleDatePreset(preset: DatePreset) {
    setDatePreset(preset)
    if (preset === "custom") {
      const { dateFrom: _df, dateTo: _dt, ...rest } = filters
      onChange(rest)
    } else {
      const range = getDateRange(preset)
      onChange({ ...filters, ...range })
    }
  }

  function handleCustomDateApply() {
    onChange({
      ...filters,
      dateFrom: customFrom ? new Date(customFrom).toISOString() : undefined,
      dateTo: customTo ? new Date(customTo).toISOString() : undefined,
    })
  }

  function handleSizePreset(preset: SizePreset) {
    setSizePreset(preset)
    const range = getSizeRange(preset)
    onChange({ ...filters, ...range })
  }

  function handleClear() {
    setDatePreset("")
    setSizePreset("")
    setCustomFrom("")
    setCustomTo("")
    onClear()
  }

  const typeValue = filters.type ?? "all"

  return (
    <div className="w-72 rounded-xl border bg-card p-4 shadow-lg space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Filtreler</span>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClear}>
            <X className="mr-1 h-3 w-3" />
            Temizle
          </Button>
        )}
      </div>

      <Separator />

      {/* File type */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Dosya Tipi</p>
        <div className="flex gap-1">
          {(["all", "file", "folder"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleTypeChange(opt)}
              className={cn(
                "flex-1 rounded-md border px-2 py-1 text-xs transition-colors",
                typeValue === opt
                  ? "border-primary bg-primary/10 text-primary font-medium"
                  : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              {opt === "all" ? "Tümü" : opt === "file" ? "Dosya" : "Klasör"}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* MIME category */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Kategori</p>
        <div className="grid grid-cols-2 gap-1.5">
          {MIME_CATEGORIES.map(({ value, label, icon: Icon }) => {
            const checked = filters.mimeCategory === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleMimeCategoryToggle(value)}
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-2 py-1.5 text-xs transition-colors",
                  checked
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <Separator />

      {/* Date range */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tarih</p>
        <div className="flex flex-wrap gap-1.5">
          {DATE_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleDatePreset(value)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                datePreset === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {datePreset === "custom" && (
          <div className="space-y-1.5 pt-1">
            <Input
              type="date"
              className="h-8 text-xs"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
            />
            <Input
              type="date"
              className="h-8 text-xs"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
            />
            <Button size="sm" className="w-full h-7 text-xs" onClick={handleCustomDateApply}>
              Uygula
            </Button>
          </div>
        )}
      </div>

      <Separator />

      {/* Size */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Boyut</p>
        <div className="space-y-1">
          {SIZE_PRESETS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                if (sizePreset === value) {
                  setSizePreset("")
                  const { minSize: _mn, maxSize: _mx, ...rest } = filters
                  onChange(rest)
                } else {
                  handleSizePreset(value)
                }
              }}
              className={cn(
                "w-full text-left rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                sizePreset === value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Starred */}
      <div className="flex items-center gap-2">
        <input
          id="filter-starred"
          type="checkbox"
          checked={filters.isStarred === true}
          onChange={(e) => {
            if (e.target.checked) {
              onChange({ ...filters, isStarred: true })
            } else {
              const { isStarred: _s, ...rest } = filters
              onChange(rest)
            }
          }}
          className="h-4 w-4 rounded border-border accent-primary"
        />
        <label htmlFor="filter-starred" className="text-sm cursor-pointer">
          Yalnızca yıldızlılar
        </label>
      </div>
    </div>
  )
}