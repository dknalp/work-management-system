# Warm Cream Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cold blue/indigo light-mode palette and Inter font with a warm cream/parchment palette and Geist Sans font, matching the Cursor.com aesthetic.

**Architecture:** Two-file change only. CSS custom properties in `globals.css` drive all shadcn/ui component colors, so replacing `:root` variables cascades everywhere automatically. Font swap in `layout.tsx` replaces Inter with Geist using the `--font-sans` variable slot.

**Tech Stack:** Next.js 15, Tailwind CSS v4, shadcn/ui, `next/font/google`

---

### Task 1: Swap Inter → Geist in layout.tsx

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update font imports and config**

Replace the current `Inter` import and instance with `Geist`. Set `variable: '--font-sans'` so Tailwind's `font-sans` utility picks it up automatically (Tailwind v4 maps `font-sans` → `var(--font-sans)`).

Current `app/layout.tsx`:
```tsx
import { Geist_Mono, Inter, Instrument_Serif } from "next/font/google"
// ...
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
// ...
className={cn("antialiased", fontMono.variable, inter.variable, instrumentSerif.variable, "font-sans")}
```

Replace with:
```tsx
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' })

const instrumentSerif = Instrument_Serif({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-instrument-serif",
})

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, geist.variable, instrumentSerif.variable, "font-sans")}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: swap Inter for Geist as primary sans-serif font"
```

---

### Task 2: Replace light-mode color palette in globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the entire `:root` block**

Find the `:root { ... }` block (lines 50–83 in the current file) and replace it entirely. Do NOT touch the `.dark { ... }` block.

Replace the `:root` block with:

```css
:root {
  --background: oklch(0.96 0.018 80);
  --foreground: oklch(0.14 0.015 60);
  --card: oklch(0.98 0.012 80);
  --card-foreground: oklch(0.14 0.015 60);
  --popover: oklch(0.98 0.012 80);
  --popover-foreground: oklch(0.14 0.015 60);
  --primary: oklch(0.16 0.015 60);
  --primary-foreground: oklch(0.97 0.008 80);
  --secondary: oklch(0.91 0.020 80);
  --secondary-foreground: oklch(0.14 0.015 60);
  --muted: oklch(0.91 0.020 80);
  --muted-foreground: oklch(0.48 0.022 70);
  --accent: oklch(0.89 0.024 80);
  --accent-foreground: oklch(0.14 0.015 60);
  --destructive: oklch(0.55 0.2 25);
  --border: oklch(0.87 0.020 80);
  --input: oklch(0.87 0.020 80);
  --ring: oklch(0.16 0.015 60 / 20%);
  --chart-1: oklch(0.55 0.12 70);
  --chart-2: oklch(0.65 0.10 75);
  --chart-3: oklch(0.72 0.08 80);
  --chart-4: oklch(0.80 0.06 85);
  --chart-5: oklch(0.88 0.04 90);
  --radius: 0.75rem;
  --sidebar: oklch(0.94 0.022 80);
  --sidebar-foreground: oklch(0.14 0.015 60);
  --sidebar-primary: oklch(0.16 0.015 60);
  --sidebar-primary-foreground: oklch(0.97 0.008 80);
  --sidebar-accent: oklch(0.89 0.024 80);
  --sidebar-accent-foreground: oklch(0.16 0.015 60);
  --sidebar-border: oklch(0.87 0.020 80);
  --sidebar-ring: oklch(0.16 0.015 60 / 20%);
}
```

- [ ] **Step 2: Verify the dev server renders correctly**

```bash
pnpm dev
```

Open `http://localhost:3000/dashboard` in a browser. Verify:
- Background is warm cream (not white/blue-white)
- Sidebar has slightly darker cream than main content
- Buttons are near-black with cream text
- Nav active states use near-black, not blue
- No blue/indigo tones anywhere in light mode
- Dark mode toggle still switches to the unchanged dark palette

- [ ] **Step 3: Run lint to catch any issues**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat: replace cold blue palette with warm cream/parchment theme (light mode)"
```
