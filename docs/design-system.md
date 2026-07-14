# Design System

Visual and interaction principles for BloomOS. No prototypes or screens exist yet, so this document is principles-level — concrete tokens (exact palette, type scale, spacing scale) get established and locked in when the first real screens are built, then recorded here as the durable reference. This file should never fall out of sync with the actual Tailwind config once one exists.

## Reference bar

Apple, Linear, Notion, and Stripe. Specifically what to borrow from each:

- **Apple** — restraint, generous whitespace, typography as the primary hierarchy tool over decoration
- **Linear** — speed and density done elegantly; keyboard-friendly, no wasted motion
- **Notion** — calm, content-first layout; UI recedes so the client/event data is what's visible
- **Stripe** — clarity and trust in anything touching money (this matters directly for the Finance and Contracts modules)

## Principles

- **Premium means restrained, not decorated.** No gradients, shadows, or effects that these reference products wouldn't ship. Elegance comes from spacing, alignment, and typography — not ornamentation.
- **Content-first.** The client's and event's data is the interface. Chrome (nav, buttons, labels) stays quiet.
- **One clear action per screen.** Primary actions are obvious; secondary actions don't compete for attention.
- **Consistent status language.** Every lifecycle stage and status (Lead status, Event `lifecycle_stage`, Contract status, Payment status — see `docs/database.md`) gets one consistent visual treatment (a shared badge component), not a bespoke look per module.
- **Motion is functional, not decorative.** Transitions clarify state changes; they don't perform.

## Structure (to be finalized with tokens)

- **Typography:** a single type family, a small deliberate scale (not more than ~5-6 sizes), weight used for hierarchy before size is.
- **Color:** a neutral-led palette with a single accent color used sparingly for primary actions and key status; semantic colors (success/warning/danger) reserved strictly for status meaning, never decoration.
- **Spacing:** a consistent spacing scale (e.g., 4px base unit) applied uniformly across modules.
- **Density:** comfortable on desktop, never cramped on mobile — density is a deliberate choice per viewport, not an afterthought.

## Where this becomes concrete

Tailwind CSS v4 is in use, which defines tokens as CSS custom properties in `src/app/globals.css` (via `@theme`) rather than a `tailwind.config.ts` file — that file is the executable source of truth for tokens now.

### Current tokens (provisional — set with the AppShell/Dashboard shell, revisit once real screens accumulate)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-surface` | `#ffffff` | `#171412` | Card/panel backgrounds |
| `--color-surface-muted` | `#fafaf9` | `#1f1b19` | App background |
| `--color-border` | `#e7e5e4` | `#322c29` | Hairlines, card borders |
| `--color-text` | `#1c1917` | `#f5f1ee` | Primary text |
| `--color-text-muted` | `#78716c` | `#a39a94` | Secondary text, labels |
| `--color-accent` | `#9f4a5c` | `#d98a9a` | Primary actions, active nav state |
| `--color-accent-foreground` | `#ffffff` | `#1c1917` | Text/icons on accent |

Font: system font stack (`ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`) rather than a loaded webfont, to avoid a build-time network dependency — revisit once a specific typeface is chosen deliberately.

Spacing and type scale beyond the above are Tailwind's defaults for now; a deliberate scale is defined once enough real screens exist to validate one (per "Explicitly out of scope for now" below), not invented ahead of that.

## Explicitly out of scope for now

Picking a final custom typeface, a deliberate type/spacing scale, or component-level visual specs beyond what the AppShell and Dashboard shell needed. Locking these in prematurely, without more real screens to test them against, produces a design system nobody has validated.
