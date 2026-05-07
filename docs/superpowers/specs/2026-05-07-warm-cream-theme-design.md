# Design Spec: Warm Cream Theme Redesign

**Date:** 2026-05-07  
**Scope:** Light mode only — dark mode untouched  
**Approach:** CSS variable replacement + Geist font swap

---

## Goal

Replace the current cold blue/indigo palette and Inter font with a warm cream/parchment palette and Geist Sans font. Target aesthetic: Cursor.com — near-black text on warm off-white, minimal color accent, clean and readable.

---

## Typography

- **Primary font:** Geist (sans-serif) — replace Inter as `--font-sans`
- **Mono font:** Geist Mono (already loaded) — keep as `--font-mono`
- **Serif font:** Instrument Serif — keep for landing page headings
- **Change:** In `app/layout.tsx`, replace `Inter` import with `Geist` from `next/font/google`, update the variable to `--font-geist` and assign it as the body font via `font-sans` utility

---

## Color Palette (`:root` light mode only)

All hues shift from cold 240–260 range to warm 60–80 range.

| Token | Current (oklch) | New (oklch) | Notes |
|---|---|---|---|
| `--background` | `0.985 0.002 240` | `0.96 0.018 80` | Warm parchment — Cursor-like off-white |
| `--foreground` | `0.2 0.02 240` | `0.14 0.015 60` | Near-black, warm tint |
| `--card` | `1 0 0` | `0.98 0.012 80` | Slightly lighter than background |
| `--card-foreground` | `0.2 0.02 240` | `0.14 0.015 60` | Same as foreground |
| `--popover` | `1 0 0` | `0.98 0.012 80` | Match card |
| `--popover-foreground` | `0.2 0.02 240` | `0.14 0.015 60` | Match foreground |
| `--primary` | `0.45 0.15 260` | `0.16 0.015 60` | Near-black buttons (Cursor style) |
| `--primary-foreground` | `0.985 0 0` | `0.97 0.008 80` | Cream on dark button |
| `--secondary` | `0.96 0.005 240` | `0.91 0.020 80` | Warm light beige |
| `--secondary-foreground` | `0.2 0.02 240` | `0.14 0.015 60` | Near-black |
| `--muted` | `0.96 0.005 240` | `0.91 0.020 80` | Same as secondary |
| `--muted-foreground` | `0.5 0.02 240` | `0.48 0.022 70` | Warm medium brown |
| `--accent` | `0.94 0.01 240` | `0.89 0.024 80` | Warm biscuit hover states |
| `--accent-foreground` | `0.2 0.02 240` | `0.14 0.015 60` | Near-black |
| `--border` | `0.92 0.01 240` | `0.87 0.020 80` | Warm tan border |
| `--input` | `0.92 0.01 240` | `0.87 0.020 80` | Match border |
| `--ring` | `0.45 0.15 260 / 20%` | `0.16 0.015 60 / 20%` | Subtle dark ring |
| `--destructive` | `0.55 0.2 25` | `0.55 0.2 25` | Keep — red already warm |
| `--radius` | `0.75rem` | `0.75rem` | Keep |

### Chart colors (light mode)

Shift from indigo to warm amber/brown progression:

| Token | New (oklch) |
|---|---|
| `--chart-1` | `0.55 0.12 70` (warm amber) |
| `--chart-2` | `0.65 0.10 75` |
| `--chart-3` | `0.72 0.08 80` |
| `--chart-4` | `0.80 0.06 85` |
| `--chart-5` | `0.88 0.04 90` |

### Sidebar (light mode)

| Token | New (oklch) |
|---|---|
| `--sidebar` | `0.94 0.022 80` (slightly darker than background for depth) |
| `--sidebar-foreground` | `0.14 0.015 60` |
| `--sidebar-primary` | `0.16 0.015 60` |
| `--sidebar-primary-foreground` | `0.97 0.008 80` |
| `--sidebar-accent` | `0.89 0.024 80` |
| `--sidebar-accent-foreground` | `0.16 0.015 60` |
| `--sidebar-border` | `0.87 0.020 80` |
| `--sidebar-ring` | `0.16 0.015 60 / 20%` |

---

## Files Changed

1. **`app/globals.css`** — replace all `:root` CSS variable values (dark mode block untouched)
2. **`app/layout.tsx`** — swap `Inter` → `Geist`, update className

---

## Out of Scope

- Dark mode colors
- Component-level structural changes
- Landing page (`/`) — shares same CSS variables, will also benefit
- Any layout, spacing, or component logic changes