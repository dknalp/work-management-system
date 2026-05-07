# Brand Style Specification — WorkOS (Light Theme)

> Generated from codebase analysis. All values sourced from `app/globals.css`, component files, and `app/layout.tsx`. Dark theme excluded per request.

---

## 1. Overview

| Attribute | Value |
|---|---|
| Product name | WorkOS / WorkSync |
| Style direction | Minimal, warm-neutral, professional SaaS |
| Design system | shadcn/ui (`radix-nova` style) + Tailwind CSS v4 |
| Component library | Radix UI primitives via `radix-ui` v1.4 |
| Color space | `oklch` throughout — no hex or hsl hardcoded in tokens |
| Consistency level | High in app shell; significant hardcoded exceptions in task/kanban status colors |
| Maturity | Production-ready skeleton; semantic tokens fully defined |

**Personality:** The light theme uses a warm off-white background with subtle amber/brown-hue tints (hue ~60–80 in oklch). The overall feel is calm, low-contrast, professional — closer to paper than pure white. There is no saturated brand color; the brand relies on tone and warmth contrast rather than a hue accent.

---

## 2. Color Palette (Light Theme Only)

All values from `:root` in `app/globals.css` unless noted.

### 2.1 Background Colors

| Token | oklch Value | Approx. Hex | Usage |
|---|---|---|---|
| `--background` | `oklch(0.974 0.008 80)` | ~`#F9F7F4` | Page background |
| `--card` | `oklch(0.99 0.004 80)` | ~`#FEFEFE` | Card surfaces |
| `--popover` | `oklch(0.99 0.006 80)` | ~`#FEFEFE` | Popover, tooltip panels |
| `--sidebar` | `oklch(0.948 0.012 78)` | ~`#F4F1EC` | Sidebar background |
| `--sidebar-accent` | `oklch(0.962 0.009 80)` | ~`#F7F5F1` | Sidebar nav item hover/active |
| `--muted` | `oklch(0.91 0.020 80)` | ~`#EDE9E2` | Muted surfaces, card footers |
| `--secondary` | `oklch(0.91 0.020 80)` | ~`#EDE9E2` | Identical to `--muted` |
| `--accent` | `oklch(0.89 0.024 80)` | ~`#E8E3DA` | Accent hover states |

### 2.2 Text Colors

| Token | oklch Value | Approx. Hex | Usage |
|---|---|---|---|
| `--foreground` | `oklch(0.14 0.015 60)` | ~`#1A1714` | Primary body text |
| `--card-foreground` | `oklch(0.14 0.015 60)` | ~`#1A1714` | Text on cards |
| `--popover-foreground` | `oklch(0.14 0.015 60)` | ~`#1A1714` | Text in popovers |
| `--primary-foreground` | `oklch(0.97 0.008 80)` | ~`#F8F6F3` | Text on primary buttons |
| `--muted-foreground` | `oklch(0.48 0.022 70)` | ~`#706860` | Placeholder, captions, meta text |
| `--sidebar-foreground` | `oklch(0.14 0.015 60)` | ~`#1A1714` | Sidebar nav text |

### 2.3 Primary / Brand Color

| Token | oklch Value | Approx. Hex | Usage |
|---|---|---|---|
| `--primary` | `oklch(0.16 0.015 60)` | ~`#201D19` | CTA buttons, logo icon bg, active states |
| `--sidebar-primary` | `oklch(0.16 0.015 60)` | ~`#201D19` | Same as primary (sidebar context) |

The primary is a very dark warm charcoal — effectively near-black with a subtle warm undertone. No saturated brand hue exists.

### 2.4 Border / Input Colors

| Token | oklch Value | Approx. Hex | Usage |
|---|---|---|---|
| `--border` | `oklch(0.87 0.020 80)` | ~`#E0DAD0` | General borders, dividers |
| `--input` | `oklch(0.87 0.020 80)` | ~`#E0DAD0` | Input field border (identical to border) |
| `--sidebar-border` | `oklch(0.930 0.010 78)` | ~`#EDE9E4` | Sidebar internal separators |
| `--ring` | `oklch(0.16 0.015 60 / 20%)` | near-black @ 20% | Focus ring |
| `--sidebar-ring` | `oklch(0.16 0.015 60 / 20%)` | same | Sidebar focus ring |

### 2.5 Semantic / State Colors

| Token | oklch Value | Usage |
|---|---|---|
| `--destructive` | `oklch(0.55 0.2 25)` | Error states, delete actions, blocked status, notification dot |

No `--success`, `--warning`, or `--info` tokens are defined. Status states in the task table use hardcoded Tailwind colors outside the token system (see Section 10).

### 2.6 Chart / Data Visualization Colors

A warm amber-to-cream progression (hue 70–90):

| Token | oklch Value | Approx. Hex |
|---|---|---|
| `--chart-1` | `oklch(0.55 0.12 70)` | ~`#8A7048` |
| `--chart-2` | `oklch(0.65 0.10 75)` | ~`#A08E6A` |
| `--chart-3` | `oklch(0.72 0.08 80)` | ~`#B5A484` |
| `--chart-4` | `oklch(0.80 0.06 85)` | ~`#C8BAAA` |
| `--chart-5` | `oklch(0.88 0.04 90)` | ~`#DACED4` |

### 2.7 Hardcoded Status Colors (Outside Token System)

Found in `components/tasks/task-columns.tsx` and `components/dashboard/board/kanban-card.tsx`. These bypass the design token system entirely:

| Usage | Tailwind Class | Color |
|---|---|---|
| Status: In Progress | `text-blue-600 bg-blue-50 border-blue-500/30` | Blue |
| Status: Done | `text-emerald-700 bg-emerald-50 border-emerald-500/30` | Green |
| Priority: Low | `text-slate-500 bg-slate-50 border-slate-400/30` | Slate |
| Priority: Medium | `text-amber-700 bg-amber-50 border-amber-500/30` | Amber |
| Priority: High | `text-rose-700 bg-rose-50 border-rose-500/30` | Rose |
| Overdue date | `text-rose-600` | Rose |
| Kanban Low | `bg-blue-500/10 text-blue-500 border-blue-500/20` | Blue |
| Kanban Medium | `bg-orange-500/10 text-orange-500 border-orange-500/20` | Orange |
| Kanban High | `bg-rose-500/10 text-rose-500 border-rose-500/20` | Rose |

These are the **only** saturated colors in the light theme. They are completely separate from the warm-neutral token system.

### 2.8 Interactive State Colors

| State | Pattern | Source |
|---|---|---|
| Hover (button) | `hover:bg-muted` or `hover:bg-primary/80` | `button.tsx` |
| Hover (sidebar nav) | `hover:bg-sidebar-accent` | `sidebar.tsx` |
| Active (sidebar nav) | `data-active:bg-sidebar-accent data-active:font-medium` | `sidebar.tsx` |
| Focus ring | `focus-visible:ring-3 focus-visible:ring-ring/50` | `button.tsx`, `input.tsx` |
| Disabled | `disabled:opacity-50 disabled:pointer-events-none` | buttons, inputs |
| Selected table row | `data-[state=selected]:bg-muted` | `table.tsx` |
| Table row hover | `hover:bg-muted/50` | `table.tsx` |
| Card hover | `hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5` | `stats-cards.tsx` |
| Drag placeholder | `border-2 border-dashed border-primary/20 bg-primary/5 opacity-50` | `kanban-card.tsx` |
| Drag overlay | `rotate-1 scale-105 border-primary shadow-xl` | `kanban-card.tsx` |

---

## 3. Typography

### 3.1 Font Families

| Role | Font | CSS Variable | Load Method |
|---|---|---|---|
| Sans-serif (body, UI) | Geist | `--font-sans` | `next/font/google` |
| Heading | Geist (aliased) | `--font-heading` | Same as `--font-sans` |
| Serif accent | Instrument Serif | `--font-instrument-serif` | `next/font/google`, weight 400 only |
| Monospace | Geist Mono | `--font-mono` | `next/font/google` |

`--font-heading` is currently aliased to `--font-sans`. Instrument Serif is loaded but only used in the landing hero — not in the app shell. The hero uses `font-instrument` (an undeclared Tailwind class — likely works via the CSS variable but not formally wired).

### 3.2 Type Scale (Observed Usage)

| Style | Classes | Size | Weight | Usage | Source |
|---|---|---|---|---|---|
| Landing H1 | `text-5xl md:text-7xl tracking-tight` | 3rem–4.5rem | — | Hero headline | `landing/hero.tsx` |
| Page heading | `text-2xl sm:text-3xl font-semibold tracking-tight` | 1.5–1.875rem | 600 | Dashboard greeting | `welcome-banner.tsx` |
| Dialog title | `text-lg font-semibold tracking-tight` | 1.125rem | 600 | Modals | `dialog.tsx` |
| Section / card title | `text-base font-medium` | 1rem | 500 | Card headers | `card.tsx` |
| Stat value | `text-3xl font-bold tracking-tight tabular-nums` | 1.875rem | 700 | KPI numbers | `stats-cards.tsx` |
| Body / UI | `text-sm` | 0.875rem | 400 | Most UI elements | global |
| Caption / meta | `text-xs` | 0.75rem | 400–500 | Labels, badges, meta | various |
| Label (uppercase) | `text-xs font-medium tracking-wide uppercase` | 0.75rem | 500 | Form labels in dialogs | `kanban-card.tsx` |
| Logo / brand | `text-base font-semibold tracking-tight` | 1rem | 600 | Sidebar brand name | `app-sidebar.tsx` |
| Monospace ID | `font-mono text-xs text-muted-foreground` | 0.75rem | 400 | Task IDs in table | `task-columns.tsx` |
| Keyboard shortcut | `font-mono text-[10px] font-medium` | 10px | 500 | ⌘K hint | `site-header.tsx` |
| Stat label | `text-xs font-medium tracking-wider uppercase` | 0.75rem | 500 | KPI card labels | `stats-cards.tsx` |

### 3.3 Letter Spacing

| Pattern | Usage |
|---|---|
| `tracking-tight` | Headings, logo, stat values, dialog titles |
| `tracking-wide` + `uppercase` | Form labels, stat category labels |
| `tracking-wider` + `uppercase` | Priority badges in kanban |
| Default | All body text |

---

## 4. Spacing, Margins, and Layout

### 4.1 Common Spacing Values

| Value | px | Usage |
|---|---|---|
| `gap-1` | 4px | Dense icon/badge gaps |
| `gap-1.5` | 6px | Button/badge icon gap |
| `gap-2` | 8px | Standard flex gap, nav items |
| `gap-2.5` | 10px | Sidebar logo area |
| `gap-4` | 16px | Card internal gap, grid columns |
| `gap-6` | 24px | Kanban column gap |
| `p-2` | 8px | Sidebar header/footer/group |
| `p-4` | 16px | Card content, dialog content |
| `p-6` | 24px | Dialog panel |
| `px-2.5` | 10px | Button horizontal padding |
| `px-4` | 16px | Header padding |
| `px-6` | 24px | Header padding on `lg:` |
| `py-4` | 16px | Card vertical |
| `pt-32 pb-20` | 128/80px | Landing hero section |

### 4.2 Fixed Dimensions

| Component | Value |
|---|---|
| Button default height | `h-8` (32px) |
| Button sm height | `h-7` (28px) |
| Button lg height | `h-9` (36px) |
| Button icon size | `size-8` (32×32px) |
| Landing CTA height | `h-12` (48px) |
| Input height | `h-8` (32px) |
| Badge height | `h-5` (20px); `h-6` in status badges |
| Table header row | `h-10` (40px) |
| Sidebar width (desktop) | `16rem` (256px) |
| Sidebar width (mobile) | `18rem` (288px) |
| Sidebar icon-mode width | `3rem` (48px) |
| Logo icon container | `size-7` (28×28px) |
| Assignee avatar | `size-6` (24×24px) |

### 4.3 Layout Containers

| Pattern | Usage |
|---|---|
| `SidebarProvider` + `SidebarInset` | All app pages (not landing) |
| `SidebarInset`: `rounded-xl bg-background border shadow-md m-2 ml-0` | Main content panel |
| `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4` | Stats grid |
| `flex min-h-svh w-full` | Full-height sidebar wrapper |
| `max-w-md` | Search bar |
| `max-w-lg` | Dialog |
| `max-w-2xl` | Hero subheading |
| `max-w-3xl` | Hero headline |
| `max-w-5xl` | App mockup frame |
| `max-w-6xl` | Landing page section |

### 4.4 Responsive Breakpoints

Tailwind v4 defaults — no custom breakpoints defined:

| Prefix | Min-width |
|---|---|
| `sm:` | 640px |
| `md:` | 768px |
| `lg:` | 1024px |
| `xl:` | 1280px |

---

## 5. Components

### 5.1 Buttons

Source: `components/ui/button.tsx`

Base: `inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none`

| Variant | Light Theme Style |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `outline` | `border-border bg-background hover:bg-muted` |
| `secondary` | `bg-secondary text-secondary-foreground hover:bg-secondary/80` |
| `ghost` | `hover:bg-muted hover:text-foreground` |
| `destructive` | `bg-destructive/10 text-destructive hover:bg-destructive/20` |
| `link` | `text-primary underline-offset-4 hover:underline` |

**Landing page exception:** CTA uses `bg-foreground text-background rounded-full h-12` — diverges from app button conventions.

Focus: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`
Active: `active:translate-y-px` (subtle press)
Disabled: `disabled:opacity-50 disabled:pointer-events-none`

| Size | Height | Classes |
|---|---|---|
| `xs` | `h-6` | `px-2 text-xs rounded-[min(var(--radius-md),10px)]` |
| `sm` | `h-7` | `px-2.5 text-[0.8rem] rounded-[min(var(--radius-md),12px)]` |
| `default` | `h-8` | `px-2.5 gap-1.5` |
| `lg` | `h-9` | `px-2.5 gap-1.5` |
| `icon` | `size-8` | — |
| `icon-sm` | `size-7` | — |
| `icon-lg` | `size-9` | — |

### 5.2 Inputs

Source: `components/ui/input.tsx`

`h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-base md:text-sm transition-colors outline-none placeholder:text-muted-foreground`

Focus: `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50`
Disabled: `disabled:bg-input/50 disabled:opacity-50`
Invalid: `aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20`

Search in header variant: `bg-muted/50 h-9 rounded-lg` — switches to `bg-background` on focus.

A bare `<input>` with custom classes also appears in `kanban-card.tsx` (not using the Input component). See Section 10.

### 5.3 Cards

Source: `components/ui/card.tsx`

Base: `flex flex-col gap-4 overflow-hidden rounded-xl bg-card py-4 text-sm text-card-foreground ring-1 ring-foreground/10`

| Size | Gap | Padding | Title size |
|---|---|---|---|
| `default` | `gap-4` | `py-4` / `px-4` | `text-base font-medium` |
| `sm` | `gap-3` | `py-3` / `px-3` | `text-sm font-medium` |

- Footer: `rounded-b-xl border-t bg-muted/50 p-4`
- Shadow substitute: `ring-1 ring-foreground/10`
- Stat card hover: `hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300`

### 5.4 Badges

Source: `components/ui/badge.tsx`

Base: `inline-flex h-5 rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all`

| Variant | Style |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `destructive` | `bg-destructive/10 text-destructive` |
| `outline` | `border-border text-foreground` |
| `ghost` | `hover:bg-muted` |

Status badges (`h-6 gap-1.5 px-2`) and priority badges use `variant="outline"` + hardcoded color overrides (see Section 2.7).

Tag badges: `bg-primary/5 border-primary/10 text-primary h-5 px-1.5 text-[10px]`

### 5.5 Navigation / Sidebar

Source: `components/ui/sidebar.tsx`, `components/app-sidebar.tsx`

- Sidebar bg: `bg-sidebar` — slightly darker and warmer than page bg
- Inset variant inner panel: `rounded-xl`
- Menu button height: `h-8`, gap: `gap-2`, text: `text-sm`
- Active: `data-active:bg-sidebar-accent data-active:font-medium`
- Hover: `hover:bg-sidebar-accent hover:text-sidebar-accent-foreground`
- Group labels: `text-xs font-medium text-sidebar-foreground/70`
- Logo icon: `size-7 rounded-lg bg-primary text-primary-foreground shadow-sm`
- Sub-menu: indented with `border-l border-sidebar-border mx-3.5 px-2.5`
- Separator: `bg-sidebar-border mx-2`
- Keyboard shortcut: `⌘B` toggles sidebar

### 5.6 Site Header

Source: `components/site-header.tsx`

`sticky top-0 z-50 h-(--header-height) border-b border-border bg-background/95 backdrop-blur-sm transition-[width,height] ease-linear`

Frosted glass: `bg-background/95 backdrop-blur-sm`
Contains: sidebar trigger → separator → breadcrumb | search | notifications → separator → Create button

Notification indicator: `animate-ping rounded-full bg-destructive` pulsing dot (no ARIA live region).

### 5.7 Dialogs / Modals

Source: `components/ui/dialog.tsx`

- Overlay: `fixed inset-0 z-50 bg-black/80`
- Panel: `fixed top-[50%] left-[50%] max-w-lg border bg-background p-6 shadow-lg sm:rounded-lg`
- Title: `text-lg font-semibold tracking-tight`
- Description: `text-sm text-muted-foreground`
- Close: `absolute top-4 right-4 rounded-sm opacity-70 hover:opacity-100`

### 5.8 Tables

Source: `components/ui/table.tsx`

- Text: `text-sm`
- Header cell: `h-10 px-2 font-medium text-foreground`
- Body cell: `p-2 align-middle whitespace-nowrap`
- Row hover: `hover:bg-muted/50`
- Row selected: `data-[state=selected]:bg-muted`
- Footer: `border-t bg-muted/50 font-medium`
- Separator: `border-b` on each row

### 5.9 Kanban Board

Source: `components/dashboard/board/`

- Column gap: `gap-6`, horizontal scroll with `.scrollbar-thin`
- Cards use the `Card` component (`rounded-xl ring-1 ring-foreground/10`)
- Kanban card hover: `hover:border-primary/30 hover:shadow-md`
- Dragging placeholder: `h-[120px] rounded-xl border-2 border-dashed border-primary/20 bg-primary/5 opacity-50`
- Drag overlay: `rotate-1 scale-105 border-primary shadow-xl`
- Double-click to edit card

---

## 6. Borders, Radius, and Shadows

### 6.1 Border Radius Scale

Base: `--radius: 0.75rem` (12px)

| Token | Formula | Computed | Used For |
|---|---|---|---|
| `--radius-sm` | `* 0.6` | ~7px | Close button, small elements |
| `--radius-md` | `* 0.8` | ~10px | Button xs/sm override |
| `--radius-lg` | `* 1.0` | 12px | Buttons (default), inputs, logo icon |
| `--radius-xl` | `* 1.4` | ~17px | Cards (`rounded-xl`), sidebar inset, header bar |
| `--radius-2xl` | `* 1.8` | ~22px | App mockup frame, landing |
| `--radius-3xl` | `* 2.2` | ~26px | Available, not observed in use |
| `--radius-4xl` | `* 2.6` | ~31px | Badges (`rounded-4xl`) |
| `rounded-full` | 9999px | — | Avatars, notification dot, landing CTAs |

### 6.2 Borders

| Pattern | Usage |
|---|---|
| `border border-border` | Default for most elements |
| `border border-input` | Input fields |
| `ring-1 ring-foreground/10` | Card shadow substitute |
| `border-b border-sidebar-border` | Sidebar header separator |
| `border-b` | Table row separators |
| `border-2 border-dashed border-primary/20` | Kanban drag placeholder |
| Global `@apply border-border` | Applied to `*` element |

### 6.3 Shadow Levels (Elevation System)

| Level | Value | Usage |
|---|---|---|
| Surface | `ring-1 ring-foreground/10` | Cards |
| Minimal | `shadow-xs` | Date pill in welcome banner |
| Panel | `shadow-md` | Sidebar inset main area |
| Overlay | `shadow-lg` | Dialogs |
| Floating | `shadow-xl` | Floating sidebar, drag overlay |
| Hover accent | `shadow-xl shadow-primary/5` | Stat card on hover |
| Logo icon | `shadow-sm` | Brand logo icon |

No custom shadow tokens — Tailwind defaults used throughout.

---

## 7. Animation and Motion Style

| Motion Type | Duration | Easing | Usage | Source |
|---|---|---|---|---|
| Sidebar collapse width | `duration-200` | `ease-linear` | Width/position transition | `sidebar.tsx` |
| Sidebar inner panel | `duration-300` | default | All-property transition | `sidebar.tsx` |
| Group label fade | `duration-200` | `ease-linear` | Margin/opacity on collapse | `sidebar.tsx` |
| Button interactions | ~150ms (default) | default | `transition-all` | `button.tsx` |
| Input border color | ~150ms | default | `transition-colors` | `input.tsx` |
| Notification ping | CSS `animate-ping` | — | Pulsing dot on bell icon | `site-header.tsx` |
| Header resize | `ease-linear` | — | Width/height on sidebar collapse | `site-header.tsx` |
| Stat card lift | `duration-300` | default | `hover:-translate-y-1` | `stats-cards.tsx` |
| Icon hover scale | `group-hover:scale-110` | — | GitHub icon in landing CTA | `landing/hero.tsx` |
| Landing badge entry | `animate-in duration-1000 fade-in slide-in-from-bottom-4` | — | Open source badge on hero | `landing/hero.tsx` |
| Drag overlay | instant | — | `rotate-1 scale-105` on pick-up | `kanban-card.tsx` |
| Drop animation | — | — | `opacity-0.5` via dnd-kit | `kanban-board.tsx` |

**Library:** `tw-animate-css` imported globally provides `animate-in`, `fade-in`, `slide-in-from-*` utilities. No custom keyframes defined in `globals.css`.

**Motion personality:** Functional and restrained. Transitions are 150–300ms with linear or default ease. No spring physics. Motion communicates state (collapse, hover, drag) rather than brand personality. The one exception is the landing page entry animation (1000ms) which is more expressive.

---

## 8. Iconography and Imagery

| Attribute | Value | Source |
|---|---|---|
| Icon library | `lucide-react` v1.11 | `package.json` |
| Default icon size | `size-4` (16px) via `[&_svg:not([class*='size-'])]:size-4` | `button.tsx` |
| Small icons | `size-3` (12px), `size-3.5` (14px) | badges, context menus |
| Large icons | `size-5`, `size-6` | feature sections |
| Stroke style | Lucide default (~1.5px) | — |
| Icon color | Inherits from text; `text-muted-foreground` for secondary | various |
| Logo icon | `BriefcaseIcon` in `size-7 rounded-lg bg-primary` container | `app-sidebar.tsx` |
| Avatars | Radix `<Avatar>` with `<AvatarFallback>` initials; `size-6 border-2 border-background` | kanban, tasks |
| Assignee initials | `size-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold` | `task-columns.tsx` |
| Landing hero mockup | `<img src="/task-page-v2.png">` — screenshot image | `landing/hero.tsx` |
| Decorative gradients | `from-blue-200/40 via-red-100/30 to-green-100/40 blur-2xl` | landing hero glow |

---

## 9. Accessibility Notes

| Area | Status | Notes |
|---|---|---|
| Focus rings | Defined | `focus-visible:ring-3 focus-visible:ring-ring/50` on all interactive elements |
| Keyboard navigation | Supported | Sidebar `⌘B` toggle; Radix handles focus trapping in dialogs |
| Screen reader labels | Present | `sr-only` on sidebar trigger, dialog close, table action buttons |
| Primary contrast | Likely WCAG AA | `oklch(0.16)` on `oklch(0.974)` — high contrast |
| Muted-foreground contrast | Needs verification | `oklch(0.48)` on `oklch(0.974)` — may fail AA for `text-xs` |
| Status colors | Accessible | Status badges combine color + icon + label text |
| Priority colors (table) | Accessible | Color + colored dot + text label |
| Kanban priority | Acceptable | Color + uppercase text label — no icon |
| Drag and drop | Partial | Keyboard drag not implemented; `cursor-grab` visual only |
| `readOnly` search input | Correct | Has `aria-label="Global search"` |
| Notification dot | Missing ARIA | No live region for notification count; purely visual |
| Disabled states | `opacity-50` only | No shape/pattern differentiation |

---

## 10. Inconsistencies and Recommendations

| Issue | Evidence | Recommendation |
|---|---|---|
| `--muted` and `--secondary` are identical | Both `oklch(0.91 0.020 80)` | Document as intentional or consolidate; shadcn uses them for different semantic roles |
| Status/priority colors bypass token system | `text-blue-600 bg-blue-50`, `text-emerald-700`, `text-rose-600` in `task-columns.tsx` | Replace with `--success`, `--warning`, `--info` tokens or chart color tokens |
| Kanban and task table use different color coding for same priorities | Kanban: blue/orange/rose; Table: slate/amber/rose | Unify to a single priority color system |
| `--font-heading` aliased to `--font-sans` | `--font-heading: var(--font-sans)` in `@theme inline` | Either differentiate (e.g. Instrument Serif for headings) or remove the alias |
| Instrument Serif nearly unused in app | Only appears in landing hero; `font-instrument` class (not formally registered) | Either use it intentionally across display headings or remove font load |
| Landing page uses different button shape | Landing CTAs use `rounded-full h-12`; app uses `rounded-lg h-8/h-9` | Intentional brand distinction or align patterns |
| No `--success`, `--warning`, `--info` semantic tokens | Missing from `:root` | Add tokens alongside `--destructive` |
| Dialog uses `sm:rounded-lg` (~8px) while cards use `rounded-xl` (12px) | `dialog.tsx` vs `card.tsx` | Align dialog to `rounded-xl` |
| Bare `<input>` in kanban card detail dialog | `kanban-card.tsx:275` — not using `<Input>` component | Replace with `<Input>` for consistency |
| Hardcoded `border-radius: 10px` in scrollbar | `app/globals.css` scrollbar-thin utility | Use `var(--radius-md)` |
| Shadow strategy inconsistent | Cards: `ring-1`; panels: `shadow-md`; dialogs: `shadow-lg` | Document the elevation system formally (it's actually reasonable as-is) |
| `hover:shadow-primary/5` on stat cards is very subtle | May be imperceptible on some screens | Test and potentially increase to `/10` |
| Product name inconsistency | Sidebar says "WorkOS", hero says "WorkSync" | Align to one name |

---

## 11. Design Token Draft

Proposed tokens based on the codebase. Light theme only. Values marked `/* ? */` need confirmation.

```css
:root {
  /* ─── Backgrounds ─────────────────────────────── */
  --color-background:       oklch(0.974 0.008 80);
  --color-surface:          oklch(0.990 0.004 80);   /* card, popover */
  --color-sidebar:          oklch(0.948 0.012 78);
  --color-sidebar-hover:    oklch(0.962 0.009 80);
  --color-muted:            oklch(0.910 0.020 80);   /* = secondary */

  /* ─── Text ────────────────────────────────────── */
  --color-text-primary:     oklch(0.140 0.015 60);
  --color-text-secondary:   oklch(0.480 0.022 70);
  --color-text-on-primary:  oklch(0.970 0.008 80);

  /* ─── Brand ───────────────────────────────────── */
  --color-primary:          oklch(0.160 0.015 60);   /* dark warm charcoal */

  /* ─── Semantic ────────────────────────────────── */
  --color-destructive:      oklch(0.550 0.200 25);
  /* --color-success:       oklch(0.65 0.14 145); */ /* needs definition */
  /* --color-warning:       oklch(0.70 0.15 65);  */ /* needs definition */
  /* --color-info:          oklch(0.60 0.12 240);  */ /* needs definition */

  /* ─── Borders ─────────────────────────────────── */
  --color-border:           oklch(0.870 0.020 80);
  --color-border-sidebar:   oklch(0.930 0.010 78);
  --color-ring:             oklch(0.160 0.015 60 / 20%);

  /* ─── Chart (warm amber scale) ────────────────── */
  --color-chart-1:          oklch(0.55 0.12 70);
  --color-chart-2:          oklch(0.65 0.10 75);
  --color-chart-3:          oklch(0.72 0.08 80);
  --color-chart-4:          oklch(0.80 0.06 85);
  --color-chart-5:          oklch(0.88 0.04 90);

  /* ─── Radius ──────────────────────────────────── */
  --radius-base: 0.75rem;
  --radius-sm:   calc(var(--radius-base) * 0.6);   /* ~7px  — small elements */
  --radius-md:   calc(var(--radius-base) * 0.8);   /* ~10px — button xs/sm */
  --radius-lg:   var(--radius-base);               /* 12px  — buttons, inputs */
  --radius-xl:   calc(var(--radius-base) * 1.4);   /* ~17px — cards, panels */
  --radius-2xl:  calc(var(--radius-base) * 1.8);   /* ~22px — large panels */
  --radius-pill: calc(var(--radius-base) * 2.6);   /* ~31px — badges */
  --radius-full: 9999px;                           /* avatars, dots, landing CTAs */

  /* ─── Typography ──────────────────────────────── */
  --font-sans:   "Geist", system-ui, sans-serif;
  --font-mono:   "Geist Mono", monospace;
  --font-serif:  "Instrument Serif", serif;        /* display/accent use only */
  /* --font-heading: var(--font-sans); */          /* currently aliased; no visual diff */

  /* ─── Layout ──────────────────────────────────── */
  --sidebar-width:        16rem;
  --sidebar-width-mobile: 18rem;
  --sidebar-width-icon:   3rem;

  /* ─── Elevation (conceptual, no custom shadows) ── */
  /* level-0  no shadow  — inline elements           */
  /* level-1  ring-1 ring-foreground/10 — cards      */
  /* level-2  shadow-md  — sidebar inset panel       */
  /* level-3  shadow-lg  — dialogs / modals          */
  /* level-4  shadow-xl  — floating sidebar, drag    */
}
```