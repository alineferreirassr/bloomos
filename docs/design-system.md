# Design System

Visual and interaction principles for BloomOS, plus the concrete tokens now locked in with the first real screens (Dashboard, Leads, Clients). This file must stay in sync with `src/app/globals.css`, the executable source of truth for tokens (Tailwind CSS v4 defines them as CSS custom properties via `@theme`, not a `tailwind.config.ts` file).

## Reference bar

Attio, Linear, Notion, Arc, Apple, Framer, Pitch, Superhuman, and luxury hotel/editorial branding. BloomOS is a premium operating system for luxury event businesses, not an admin dashboard — the interface should feel calm, editorial, and expensive, closer to a well-typeset magazine or a luxury brand's private workspace than a SaaS back office.

## Principles

- **Premium means restrained, not decorated.** No gradients, no heavy shadows, no bright/saturated colors. Elegance comes from whitespace, alignment, and typography.
- **Content-first.** The client's and event's data is the interface. Chrome (nav, buttons, labels) stays quiet.
- **Editorial hierarchy.** Page-level titles are large and set in a serif display face; everything else — labels, table headers, badges — stays small, quiet, and functional in the sans body face.
- **One clear action per screen.** Primary actions (soft gold) are obvious; secondary and ghost actions don't compete for attention.
- **Consistent status language.** Every lifecycle stage and status gets one shared `Badge` treatment (muted tone, thin border), never a bespoke look per module.
- **Motion is functional, not decorative.** Subtle fades/slides (150–200ms) clarify state changes (drawer open/close, hover); nothing performs for its own sake.

## Typography

| Role | Family | Notes |
|---|---|---|
| Headings (`h1`, `h2`) | Cormorant Garamond | Loaded via `next/font/google`, applied globally in `globals.css`; page titles and record names (e.g. a Client's name) render in this face automatically — no per-component class needed |
| Interface (body, labels, table headers, buttons) | Inter | Loaded via `next/font/google`; the default body face |
| Numbers (dashboard metrics) | Inter Medium | `MetricCard`'s value — deliberately sans, not serif, for legibility at a glance |

Section sub-headers inside cards (`h3`, e.g. "Contact", "Notes") stay in Inter, not serif — they're structural UI labels, not editorial titles.

## Color

A neutral, warm-toned palette with a single soft-gold accent used sparingly for primary actions, active nav state, and key status. Semantic colors (success/warning/danger) are reserved strictly for status meaning. No bright blue anywhere.

### Tokens (`src/app/globals.css`)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-background` | `#f8f6f2` | `#1c1917` | App/page background |
| `--color-sidebar` | `#f4f1ec` | `#201c19` | Sidebar and mobile nav drawer background |
| `--color-surface` | `#ffffff` | `#262220` | Card/panel/topbar/modal backgrounds |
| `--color-surface-muted` | `#f1ece3` | `#2c2723` | Hover state on nav items, buttons, table rows |
| `--color-border` | `#e7e1da` | `#3a342f` | Hairlines, card borders |
| `--color-text` | `#2e2a27` | `#f3efe9` | Primary text |
| `--color-text-muted` | `#7a736d` | `#a79e93` | Secondary text, labels, table headers |
| `--color-accent` | `#c59a5a` | `#d9ad6d` | Primary actions, active nav indicator, focus ring |
| `--color-accent-foreground` | `#2e2a27` | `#211e1b` | Text on accent-filled surfaces (dark text on gold — light text fails AA contrast against this gold) |
| `--color-success` / `-foreground` | `#6b8f71` / `#f4f8f4` | `#86ad8b` / `#16211a` | Positive status (muted green, never bright) |
| `--color-warning` / `-foreground` | `#b8863e` / `#fbf4ea` | `#d1a059` / `#241b0f` | Caution status (muted amber) |
| `--color-danger` / `-foreground` | `#8c4a4a` / `#f8f0f0` | `#b06868` / `#241414` | Error/destructive status (muted burgundy) |

Dark mode is driven by `@media (prefers-color-scheme: dark)` by default, with `:root[data-theme="dark"]` / `:root[data-theme="light"]` overrides so a manual theme toggle always wins over the OS preference.

## Spacing & density

Generous throughout — this was the biggest single change from the original provisional tokens:

- Cards: `rounded-2xl`, `p-6`–`p-7` (was `rounded-xl`, `p-5`)
- Buttons/inputs: `rounded-xl`, `py-2.5`+ (was `rounded-lg`, `py-2`)
- Table rows: `py-4` with uppercase tracked headers (was `py-3`, plain-case headers)
- Sidebar: `px-7 py-8` header block, `py-2.5` per nav item (was `px-5 py-6`, `py-2`)
- Main content padding: `p-6 md:p-10` (was `p-4 md:p-6`)

Density is still comfortable on mobile, not just shrunk desktop — the mobile nav is a full slide-in drawer with its own generous spacing and a backdrop blur, not a cramped version of the sidebar.

## Components

- **Button** — `primary` (soft gold fill, dark text, subtle brightness shift on hover), `secondary` (white, thin border), `ghost` (near-invisible, text-only until hovered). Never the Tailwind default blue/gray button look.
- **Card** — large radius, thin border, a very subtle shadow (`0 1px 2px` at 4% opacity) — no drop-shadow-heavy elevation.
- **Badge** — thin outlined pill, muted tone-on-tone (10% background tint, 25% border tint of the semantic color), never a solid fill.
- **Input / Select / Textarea** — larger height, thin border, focus state is a soft accent-colored ring plus an accent border (no default browser blue outline).
- **Sidebar** — serif wordmark, slim Lucide icons (`strokeWidth={1.5}`), current page marked by a 2px gold indicator bar to the left of the label (not a filled pill), user profile pinned to the bottom.
- **Mobile nav** — full-height drawer sliding in from the left with a blurred backdrop, `inert` when closed (fully removed from the tab order and hit-testing, not just visually hidden), same nav treatment as the desktop sidebar.
- **Icons** — [Lucide](https://lucide.dev) (`lucide-react`), wrapped by the existing named exports in `components/ui/icons.tsx` (`DashboardIcon`, `LeadsIcon`, etc.) so no call site changed when the icon set was swapped in.

## Explicitly out of scope for this pass

This was a presentation-only pass — no changes to routing, the data layer, workflows, validation, or tests. Component-level visual specs beyond what Dashboard/Leads/Clients needed (e.g. a dedicated Events/Contracts/Finance visual language) are deferred until those modules are actually built, per the existing "don't invent a design system nobody has validated" principle.
