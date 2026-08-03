# Design System

Visual and interaction principles for BloomOS, plus the concrete tokens implementing the **approved design** delivered as a handoff package (`bloomos-handoff/`, Classical design system — `_ds/classical-.../styles.css` is the authoritative source of every value below; this file must stay in sync with `src/app/globals.css`). This is not a from-scratch design — it is a faithful implementation of a prototype the founder already approved, reproduced pixel-for-pixel where the existing React architecture allows it without restructuring.

## Reference

The approved prototype: `Dashboard.dc.html`, `Leads.dc.html`, `Lead Detail.dc.html`, `Lead Form.dc.html`, `Sidebar.dc.html`, `Header.dc.html`, backed by `_ds/classical-.../styles.css`. Clients/Events/Contracts/Finance were not prototyped in that handoff — their screens follow the same tokens and component classes by extension, since the handoff's own instructions call for reusing exactly `.btn`/`.card`/`.tag`/`.field`/`.input`/`.table`/`.dialog` rather than inventing new visual language per module.

## Principles

- **Reproduce, don't reinterpret.** Every token below is copied from the approved `styles.css`, not estimated from a screenshot or redesigned to taste.
- **Borders define shape, not fill.** Cards, inputs, and buttons carry almost no background of their own — they're outlined against the page, not white boxes floating on gray. Only the sidebar and dialogs get a distinct filled surface tone.
- **Outline buttons, not filled ones.** The primary action is a gold-outlined, gold-text button that tints on hover — never a solid gold block.
- **Three status tones, not five.** `tag-outline` (in progress), `tag-accent` (won/converted), `tag-neutral` (lost/archived) — no separate success/warning/danger palette exists in the approved system.
- **Editorial hierarchy.** Page titles and card section headers are serif (Cormorant Garamond); everything else — labels, table headers, body copy — is Lora, the approved system's body face.

## Typography

| Role | Family | Size | Notes |
|---|---|---|---|
| Page/section headings (`h1`/`h2`, card titles) | Cormorant Garamond, weight 600 | h1 42px / h2 32px / card-title 17px | Loaded via `next/font/google`; global `h1, h2 { font-family: var(--font-serif) }` rule in `globals.css`, plus explicit `font-serif` utility on card section headers and buttons |
| Body / interface / table / labels | **Lora**, weight 400 | 15px body, 14px table/input, 11–12px labels | Loaded via `next/font/google` — the approved system's body face is Lora, not Inter, despite earlier prose descriptions in this project's chat history; `_ds/classical-.../styles.css` is authoritative and was followed over that prose |
| Buttons | Cormorant Garamond, weight 600 | 13px | Matches `.btn` exactly — buttons use the heading face, not the body face, in this system |

## Color

Copied verbatim from `:root` in the approved `styles.css`. No value below was redefined or estimated.

| Token | Value | Use |
|---|---|---|
| `--color-background` | `#f3f2f2` | Page background |
| `--color-sidebar` / `--color-surface` | `#eae9e9` | Sidebar fill and dialog/modal fill — the *only* two things with a distinct filled surface |
| `--color-border` | `color-mix(in srgb, #201f1d 16%, transparent)` | Every card/input/table/divider border |
| `--color-text` | `#201f1d` | Primary text |
| `--color-text-muted` | `color-mix(in srgb, #201f1d 55%, transparent)` | Secondary text — matches the approved system's `.text-muted` class exactly |
| `--color-accent` | `#b68235` | Primary actions, active nav indicator, links, tag-outline |
| `--color-accent-2` | `#ac803e` | Secondary accent (available; lightly used) |
| Accent tint ramp | `100 #fff3e4` / `800 #5a3b0a` | `tag-accent` background/text |
| Neutral tint ramp | `100 #f8f4f4` / `800 #444141` | `tag-neutral` background/text |

There is no success/warning/danger palette in the approved system. `--color-danger` (`#7d5411`, the system's own `accent-700`) is kept only for genuine form-validation error text, per the handoff's own spec: *"mensagens de erro ... em --color-accent-700"*.

## Spacing, radius, shadow

- **Radius**: `--radius-sm: 2px`, `--radius-md: 4px` (cards, buttons, inputs, sidebar nav rows), `--radius-lg: 7px` (dialogs). Tags use `3px` (`4px * 0.75`). This replaced an earlier, incorrect first pass at this redesign that used 12–16px radii — a generic-SaaS look the approved system explicitly does not have.
- **Shadow**: none by default on cards (`.card { background: transparent }` — no elevation at all). Dialogs get a soft `0 3px 10px` ink-tinted shadow.
- The approved system's own spacing scale (`--space-1` through `--space-8`, a non-standard ~4.6px base unit) was **not** imported wholesale into Tailwind's spacing scale — doing so would have silently changed the meaning of every `p-*`/`gap-*`/`m-*` utility already used across ~40 existing files (a Next.js-configuration-level change well outside "update the presentation layer"). Component-level spacing was hand-matched to the approved pixel values instead (e.g. table cell padding `9px`, card padding `14px`), using Tailwind's existing scale or arbitrary values where needed.

## Components

- **Button** (`components/ui/Button.tsx`) — `.btn-primary`/`.btn-secondary`/`.btn-ghost`: outline/transparent by default, a soft tint on hover, a stronger tint on active. Cormorant Garamond, 13px, semibold.
- **Card** (`components/ui/Card.tsx`) — `.card`: transparent background, `1px` border, `4px` radius, `14px` padding. No shadow.
- **Badge** (`components/ui/Badge.tsx`) — `.tag`: added an `outline` tone (border+text accent, no fill) alongside the existing tones, matching `.tag-outline`/`.tag-accent`/`.tag-neutral`. `LeadStatusBadge`/`ClientStatusBadge`'s status→tone lookup tables were updated to the approved 3-tone mapping (in-progress→outline, won/converted→accent, lost/archived→neutral) — a presentational lookup change only; the underlying status enums and transition rules are untouched.
- **Input / Select / Textarea** — `.input`: transparent background, `36px` min-height, `1px` divider border, accent border on focus (no default browser outline).
- **Sidebar / MobileNav** — `224px` (approximated as `14rem`/`w-56` in Tailwind's scale), serif "BloomOS" wordmark + uppercase "AMORÉ BLOOM" subtitle, nav rows with a `2px` left-border + `7%` accent-tinted background when active (never a filled pill), footer profile block with a circular initials avatar.
- **Icons** — Lucide, matching the approved icon choice per nav item exactly (Leads = `Users`, Clients = `User` singular, not swapped as they were in an earlier pass).

## Known, deliberate differences from the reference mockups

Disclosed rather than silently diverged from — each below was a scope call made because closing the gap would have meant restructuring page composition, component hierarchy, or the data layer, all explicitly out of bounds for this pass:

1. **Header action buttons.** The approved `Header.dc.html` renders the page's primary/secondary action button (e.g. "Novo lead") *inside* the persistent 72px header bar, driven by props passed down from each page. This app's `TopBar` is a dumb, prop-free breadcrumb; each page renders its own action button inline in the page body instead (e.g. "New Lead" sits at the top of `LeadsListView`'s own content, not in the header row). Changing this would mean giving `TopBar`/`AppShell` a new prop contract and touching every page — a component-hierarchy change, not a style change. The button itself uses the corrected `.btn-primary` style either way.
2. **Dashboard "Recent leads" table and "Open tasks" panel.** Not reproduced. The current `DashboardPage` renders only the KPI card grid, matching `.card`/`.card-kicker`/`.card-title` styling exactly for what exists. Adding the recent-leads table would mean growing the Dashboard page's composition (a "don't rewrite pages" boundary); the tasks panel would require inventing a `Task` entity that has no data-layer support at all in this codebase (`Task` is not a concept anywhere in `lib/data`) — squarely a data-layer change, not presentation.
3. **KPI card third line.** The approved KPI cards show a `card-meta` note line (e.g. "excl. perdidos/convertidos") below the value. `DashboardMetric` (`lib/data/index.ts`) only carries `{ label, value, href }` — no note field. Adding one is a data-layer interface change, out of scope; the label/value styling is otherwise pixel-matched.
4. **Sidebar item count.** The approved sidebar lists 13 modules (including Inventory, Suppliers, Client Portal, Bloom AI, Reports, Documents, Settings as disabled "Em breve" entries). This app's sidebar lists the 6 that have real routes today (Dashboard, Leads, Clients, Events, Contracts, Finance). Adding the other 7 as dead links, or as new placeholder routes, was judged out of bounds for a presentation-only pass — they'll be added as their modules actually ship real routes.
5. **Body font-family swap (Lora vs. Inter).** Earlier in this project's history, in-chat prose repeatedly specified Inter for body text. The actual approved design file (`styles.css`) specifies Lora. Per this task's explicit instruction to treat the handoff file as the authoritative source and not reinterpret it, Lora was used.
