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

Once implementation begins, the Tailwind config (`tailwind.config.ts`) is the executable source of truth for tokens (colors, spacing, type scale). This document should be updated at that point to reference the actual values, so design intent and implementation never drift apart.

## Explicitly out of scope for now

Picking final hex values, a type scale, or component-level visual specs before the architecture is approved and the first real screens are designed. Locking these in prematurely, without a screen to test them against, produces a design system nobody has validated.
