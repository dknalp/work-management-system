"use client"

import { CheckIcon, PaletteIcon } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const THEMES = [
  {
    name: "warm",
    label: "Warm",
    bg: "oklch(0.955 0.014 80)",
    primary: "oklch(0.16 0.015 60)",
    accent: "oklch(0.89 0.024 80)",
  },
  {
    name: "slate",
    label: "Slate",
    bg: "oklch(0.970 0.004 240)",
    primary: "oklch(0.20 0.010 250)",
    accent: "oklch(0.91 0.007 240)",
  },
  {
    name: "dark",
    label: "Dark",
    bg: "oklch(0.130 0.018 220)",
    primary: "oklch(0.650 0.120 220)",
    accent: "oklch(0.230 0.020 220)",
  },
  {
    name: "forest",
    label: "Forest",
    bg: "oklch(0.120 0.018 150)",
    primary: "oklch(0.600 0.150 145)",
    accent: "oklch(0.220 0.022 148)",
  },
  {
    name: "midnight",
    label: "Midnight",
    bg: "oklch(0.110 0.022 270)",
    primary: "oklch(0.680 0.140 265)",
    accent: "oklch(0.210 0.025 268)",
  },
]

export function ModeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-full text-muted-foreground hover:text-foreground"
          aria-label="Choose theme"
        >
          <PaletteIcon className="h-[1.2rem] w-[1.2rem]" />
          <span className="sr-only">Choose theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {THEMES.map((t) => (
          <DropdownMenuItem
            key={t.name}
            onClick={() => setTheme(t.name)}
            className="flex cursor-pointer items-center gap-2.5"
          >
            <div
              className="flex h-5 w-10 shrink-0 items-center justify-center gap-1 rounded border border-black/10"
              style={{ backgroundColor: t.bg }}
            >
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: t.primary }}
              />
              <div
                className="size-2 rounded-full opacity-60"
                style={{ backgroundColor: t.accent }}
              />
            </div>
            <span className="flex-1 text-sm">{t.label}</span>
            {theme === t.name && (
              <CheckIcon className="size-3.5 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}