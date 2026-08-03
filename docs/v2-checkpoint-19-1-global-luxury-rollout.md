# v2.0 Checkpoint 19.1 — Global Luxury Rollout

A visual unification pass, not a redesign: every module in BloomOS now inherits the same premium blush/rose luxury design language the Owner Dashboard introduced in Checkpoint 19, plus the new official Amoré Bloom circular logo everywhere the brand mark appears. No routes, permissions, business logic, or features changed.

## Strategy

Rather than hand-rewriting ~100 page files, the rollout worked at three leverage points, from broadest to narrowest:

1. **Token repoint** (`src/app/globals.css`) — the Classical design system's own `--color-*`/`--radius-*`/`--shadow-*` CSS variable *values* were changed to the Luxury palette, while every variable *name* stayed the same. Since the whole app already consistently used these token utility classes (`bg-surface`, `border-border`, `text-accent`, `rounded-md`, `shadow-sm`, …) rather than hardcoded Tailwind grays, this single file edit cascaded the blush background, rose accent, warm shadows, and larger radii to all ~100 pages and every shared primitive (Sidebar, TopBar, MobileNav, Modal, Drawer, Toast, Tooltip, Checkbox, Tabs, ProgressBar) with zero component code touched. The separate `--luxury-*` namespace Checkpoint 19 introduced is untouched, so the three approved Dashboards keep reading their own tokens unchanged.
2. **Shared primitive polish** (`src/components/ui/Card.tsx`, `Badge.tsx`, `Input.tsx`, `Select.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `Checkbox.tsx`) — small, contained visual upgrades (real surface fill + soft shadow on `Card`, pill-shaped `Badge`, blush focus ring on `Input`/`Select`) that cascade to 138/101/76/67/62/98/36 call sites respectively.
3. **Two new generic primitives** (`src/components/ui/PageHeader.tsx`, `src/components/ui/KpiCard.tsx`) — a large-serif-title hero header and an icon-chip metric card, mirroring the Owner Dashboard's own `SectionHeader`/`LuxuryMetricCard` recipe exactly, applied per-module where a genuine title block or a genuine already-fetched aggregate existed.

## Global tokens

| Token | Old (Classical) | New (Luxury) |
|---|---|---|
| `--color-background` / `--color-sidebar` | `#f3f2f2` / `#eae9e9` | `#fdf2ef` (blush) |
| `--color-surface` | `#eae9e9` | `#ffffff` |
| `--color-surface-tint` *(new)* | — | `#fdf6f4` |
| `--color-accent` | `#b68235` (gold) | `#d8695a` (rose) |
| `--color-text` | `#201f1d` | `#2a1f1c` |
| `--color-success` / `--color-warning` / `--color-danger` | aliased to the single gold accent family | real distinct hues (`#5f8d6b` / `#c98a3e` / `#c24f42`), matching the Luxury system's own Step-1 status language |
| `--radius-sm/md/lg` | 2px / 4px / 7px | 8px / 14px / 20px |
| `--shadow-sm/md/lg` | cool-gray color-mix | warm color-mix (`#7a4d43` family), matching Luxury exactly |
| Fonts | Cormorant Garamond / Lora | unchanged — already shared with Luxury |

`Checkbox.tsx` was deliberately kept off the shared `rounded-sm` token (now 8px, too round for a 16px checkbox) and pinned to an explicit `rounded-[4px]` instead — the one token consumer that needed a manual exception.

## Logo

The user-provided circular Amoré Bloom logo (camera + heart, script wordmark, ring box, "Luxury Proposals & Romantic Experiences" tagline inside a rose-ring frame) was cropped from the supplied reference sheet and saved to `public/brand/amore-bloom-app-logo.png`. It replaces the previous gold horizontal wordmark everywhere the brand appears:

- `Sidebar.tsx`, `MobileNav.tsx` (top branding)
- `WorkspaceAvatar.tsx` (the 30px circular avatar in the Sidebar/MobileNav footer — previously a gold-tinted "AB" text fallback)
- `(auth)/layout.tsx`, `AccessBlockedPage.tsx` (Sign In / blocked-access screens)
- `ClientPortalShell.tsx` (Client Portal header)
- `src/app/icon.png` (the browser tab favicon)
- `brandingSection.ts`'s `branding.logo-url` setting default — previously an empty string with no actual default asset behind the "leave blank to use the default BloomOS mark" copy; now genuinely wired, so the Owner/Team/Client Dashboards' own real, pre-existing `getLuxuryBranding()` mechanism (unchanged code, Checkpoint 19) now resolves a real logo image too, for any workspace that hasn't set its own custom one.

No "red circular floating badge" exists anywhere in the app's own code — that element in the reference screenshots is the Next.js dev-mode indicator, browser-injected tooling chrome outside the application, not something this codebase renders or controls.

## Per-module coverage

**Full treatment (PageHeader + real KPI row computed from already-fetched data + card-wrapped table):** Leads, Clients, Contracts, Events, Finance dashboard (already had 12 real metrics via `MetricCard`, which already wraps `Card` — inherited automatically), Invoices, Payments, Vendors, Purchases, Inventory, Team.

**PageHeader only** (a Kanban board, not a table, or a page whose existing KPI grid already covers this — deliberately not duplicated): Commercial Pipeline, Documents (already has its own `MetricCard` grid from `getDashboardMetrics()`), Settings, Automation, Bloom AI, Analytics (its own analytics-specific `KpiCard`/`AnalyticsExecutiveSummaryCard` left untouched), Marketplace, Developer Console, Client Accounts, Client Invitations.

**Token-inherited only** (every page not explicitly touched above — CRM Assistant, Finance Assistant, Operational Pipeline, Services, Workflow Builder, the full Client Portal, every detail/edit/new sub-page): automatically blush-backgrounded, rounded-card, rose-accented via the token repoint, without a bespoke hero header or KPI row layered on top.

Every KPI added was computed **only from real fields on data the component already fetches** — no new server calls, no fabricated numbers:

| Module | KPIs | Source |
|---|---|---|
| Leads | Total, New, Qualified, Converted | `Lead.status` |
| Clients | Total, Active, VIP | `Client.internal_status`, `Client.is_vip` |
| Contracts | Total, Signed, Signed Value | `Contract.signature_status`, `total_value` via `majorToMinor`/`sumMinor`/`formatMoney` |
| Events | Total, Upcoming, In Progress, Completed | `Event.status`, `event_date` |
| Invoices | Total, Outstanding, Total Billed | `Invoice.balance_minor`, `total_minor` |
| Payments | Total, Total Collected, Refunds | `Payment.amount_minor`, `payment_type`, `PAYMENT_STATUSES_COUNTING_TOWARD_PAID` |
| Vendors | Total, Active, Preferred | `Vendor.status`, `is_preferred` |
| Purchases | Total, Pending, Total Spend | `Purchase.status`, `total_minor` |
| Inventory | Total, Low Stock, Out of Stock | `isInventoryItemLowStock()`, `quantity_available` |
| Team | Total, Owner, Admin, Manager, Staff | `WorkspaceMemberRole` |

A real bug was caught and fixed during verification: a Contracts KPI initially computed "Signed"/"Signed Value" from `contract.status` (the overall commercial lifecycle) instead of `contract.signature_status` (the independent e-signature state machine) — this made the KPI disagree with the very "Signed" badge visible in the same table row for a contract that was e-signed but still in Draft overall status. Fixed to read `signature_status` directly, verified against the same seeded data.

## Responsive fix

All ten new KPI grids were initially built with a `sm:` (640px) breakpoint to switch from 2 to 3/4 columns, matching a common Tailwind default. Live verification at an intermediate window width (~726–800px, between the `sm` and `md` breakpoints, where the Sidebar itself switches from a mobile hamburger to the desktop rail) showed labels like "TOTAL LEADS" truncating to "TOTAL LE…" because 3–4 columns were too cramped before the sidebar had made room. Fixed by moving every new KPI grid's breakpoint from `sm:` to `md:` (768px), matching the Sidebar's own breakpoint exactly — confirmed clean at 375px (2-column, labels truncate gracefully via `text-overflow: ellipsis`, an accepted mobile-compact pattern already used in the reference mockups), ~800px (full 3/4-column, full labels), and desktop.

## Browser verification

✓ Desktop verified. ✓ Mobile verified (375×812).

Live-verified directly, both viewports, with real Supabase-backed data: Leads, Clients, Contracts, Commercial Pipeline (empty state), Events, Finance dashboard, Sign In screen (new logo + luxury inputs). Live-verified by the parallel implementation agents, both viewports: Vendors, Purchases, Inventory, Documents. Structurally verified (clean `tsc`, clean lint, passing in the full 5261-test suite, and manual code review confirming the identical, already-proven-correct `PageHeader`/`KpiCard` pattern) but not interactively live-rendered: Team, and the 8 header-only back-office modules (Settings, Automation, Bloom AI, Analytics, Marketplace, Developer Console, Client Accounts, Client Invitations) — this dev environment's real-Supabase session expired partway through verification, reproducing the identical `UnauthorizedError` on the completely untouched `/dashboard` route, confirming it as a pre-existing environment/session condition rather than a regression from this checkpoint's own changes.

Confirmed via `git status`: no file under `src/modules/dashboard/luxury/` (the three approved Dashboards' own components) shows as modified — only pre-existing, already-certified Checkpoint 19 files, untouched by this pass.

## Quality gates

| Gate | Result |
|---|---|
| `tsc --noEmit` | Clean |
| ESLint | 0 errors (16 pre-existing warnings, all unrelated to this checkpoint) |
| Test suite | **523 files, 5261 tests, all passing** |
| Production build | Clean — all ~100 routes compile |

## Known limitations

- **Not every one of the ~100 pages received a bespoke hero header + KPI row** — detail/edit/new sub-pages, the full Client Portal, and a handful of assistant/builder pages inherit the global blush/card/rose look via tokens but don't have a page-level KPI summary. This was a deliberate scope line given the size of the app, not an oversight — the modules explicitly named with example KPIs in the spec all received the full treatment.
- **Team page and 8 back-office modules were not interactively live-rendered** in this session due to the dev environment's Supabase session expiring mid-verification (confirmed pre-existing, reproducing on the untouched Dashboard route) — verified instead via clean typecheck/lint/the full passing test suite and direct code review against the same pattern already proven live-correct on 10 other modules.
- **`branding.brand-color`'s default value (`#b68235`, the old gold)** was left unchanged — it's a per-workspace configurable setting, not a rebrand of the fixed Luxury palette itself, and changing its default is a separate, smaller follow-up if desired.
- **The Next.js dev-mode indicator** (a black circle in the bottom-left corner during local development) is browser tooling, not application code — it cannot be replaced by an in-app change and disappears in production builds.
