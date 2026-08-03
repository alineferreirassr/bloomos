# BloomOS Roadmap

This roadmap sequences delivery. It does not repeat business definitions — see `BLOOMOS_BIBLE.md` for those. It does not track day-to-day tasks — see `TODO.md` for those.

## Phase 0 — Foundation (current)

- Repository initialization
- Core documentation (`README.md`, `CLAUDE.md`, `BLOOMOS_BIBLE.md`, `PRODUCT_PRINCIPLES.md`, this file, `CHANGELOG.md`, `TODO.md`)
- `docs/` specs (database, workflows, ui, automations, integrations, permissions, ai, design-system)
- Workspace concept documented (`BLOOMOS_BIBLE.md` §7) — not implemented
- Technical architecture proposed and approved
- Next.js + TypeScript + Tailwind project scaffolded, including reserved structural folders (`core/`, `services/`, `features/`, `automation/`, `audit/`, `email/`) — created as empty or interface-only placeholders for their future phase below, not populated with business logic ahead of schedule

**Exit criteria:** architecture approved by the user; project builds and runs locally with an empty shell (no business features yet).

## Phase 1 — MVP

Scope, and only scope: **Dashboard, Leads, Clients, Events, Contracts, Finance.**

1. Data model and mock data layer for the six MVP modules (no live Supabase connection required to start)
2. App shell: navigation, layout, responsive frame (desktop + mobile)
3. Dashboard shell — placeholder cards over mock data, built early so every module below becomes visible on it as it ships, rather than wired up all at once at the end
4. Leads — list, detail, create/edit, status → wire its card into the Dashboard
5. Clients — list, detail, create/edit, link to Leads and Events → wire its card into the Dashboard
6. Events — list, detail, lifecycle stage tracking, link to Clients/Contracts/Finance → wire its card into the Dashboard
7. Contracts — list, detail, status, link to Events → wire its card into the Dashboard
8. Finance — deposits/payments, balances, link to Contracts/Events → wire its card into the Dashboard
9. Supabase connection (only once real credentials exist) — replace mock data layer with live queries, schema/RLS per `docs/database.md` and `docs/permissions.md`. Complete for every Phase 1 MVP module: Leads, Clients, Events, Contracts, Finance, and Documents are now live (see `TODO.md` for status)

**Exit criteria:** the full Lead → Client → Event → Contract → Deposit slice of the lifecycle is usable end to end for Amoré Bloom, on desktop and mobile, against real (or realistic mock) data.

## Phase 2 — Operational depth

- Team Management — **Team Members + Invitations foundation complete**, and **Team Portal MVP complete**: the authenticated internal app shell — permission-aware sidebar/navigation, a central route-access map, role-aware dashboard, member session context, inactive-member/unauthorized states, and granular action-level gating across every business module (internal `owner`/`admin`/`manager`/`staff` roles, granular permissions, Supabase Auth-backed invitation flow; see `docs/permissions.md`, `docs/workflows.md`).
- Client Accounts — **Client Accounts + Invitations foundation complete**: external client authentication, account-linking (`client_accounts`), and invitation flow (`client_invitations`), a minimal Client Portal landing page (`/client-access`) and invitation acceptance page, and internal Client Access management on Client Detail — all built as a separate, wholly non-overlapping model from internal Team membership (see `docs/permissions.md`, `docs/workflows.md`).
- Client Portal — **Client Portal MVP complete**: the real external Client Portal experience — Overview, My Events, My Contracts, My Invoices, My Documents, and Account pages, a dedicated `ClientPortalShell` (never the internal `AppShell`), a canonical `ClientAccountSessionProvider` context, client-safe repository projections (`ClientPortalRepository`) with dedicated DTO types, and additive client-facing RLS policies (`is_client_account_holder_in_workspace()`) scoping Events/Contracts/Invoices/Payments/Documents to the caller's own client/workspace, plus a `security definer` RPC for signed document downloads — see `docs/permissions.md`, `docs/workflows.md`. Payment-provider integration, client document upload, and e-signature remain unstarted (Phase 3, below).
- Core foundation — **complete**: shared Notes/Timeline/Tags/Comments/Files/Audit Log/Search/Notifications/AI-provider architecture every module below builds on rather than reinventing (see `docs/database.md`, `core/`).
- Inventory — **complete**: full catalog (items, movements, condition/status workflow), linked-Vendor display, live on `/inventory` (`docs/inventory.md`).
- Suppliers (Vendors) — **complete**: full CRUD, preferred-vendor flag, reverse Inventory list on Vendor Detail, live on `/vendors`.
- Purchases — **complete** (not originally on this list, but shipped in this phase): Purchase/PurchaseItem lifecycle with an atomic receiving RPC, live on `/purchases` (`docs/purchases.md`).
- Finance Reports — **complete** (also not originally listed): General Ledger, Trial Balance, Profit & Loss, Balance Sheet, live under `/finance/reports` (`docs/finance-reports.md`).
- Services — **complete** (also not originally listed, the largest module of this phase): Service/ServiceVersion catalog, 16 normalized Template categories, the EventService Event Assignment instance layer, live on `/services` (`docs/services.md`).
- Commercial Pipeline (Booking Workflow) — **complete**: Kanban board over Lead status, Book Lead flow, pending-recovery infrastructure, live on `/pipeline/commercial`.
- Operational Pipeline board (Event lifecycle_stage Kanban) and Booking Dashboard — **in progress**, not yet started.
- Calendar — not started.

**Known limitation carried out of this phase**: Inventory, Vendors, Purchases, and Services have no granular permission of their own — all four are reachable and fully editable by any active Workspace member regardless of role (no `ROUTE_ACCESS_MAP` entry, no action-level `can()` gating). See `docs/permissions.md`'s "Inventory, Vendors, Purchases, Services (live, active-membership-only)" section. Closing this is a real product decision (naming permissions, picking default role grants) reserved for a future checkpoint, not invented here.

## Phase 3 — Client-facing & intelligence

- Client Portal payment-provider integration, client document upload, and e-signature (the account/invitation foundation and the read-only business-data Portal are already live, see Phase 2 above)
- Bloom AI (assistant)
- Automations
- Email Center
- Notifications

## Phase 4 — Scale

- Analytics
- Knowledge Base
- Global Search
- Multi-Workspace activation (data model already supports it; this phase turns it on for real — see `BLOOMOS_BIBLE.md` §7)

## Known limitations — Release Candidate (Checkpoint 12)

Found during the Checkpoint 12 production-readiness pass. None are blocking (see the Checkpoint 12 report for the full Go/No-Go reasoning); each is reserved for a dedicated future pass rather than fixed opportunistically here, since each has a wider blast radius than a hardening checkpoint should take on:

- **Pagination** — several large list views (e.g. Documents, Purchases) load their full result set client-side rather than paging server-side. Fine at current data volumes; will need real pagination before any workspace's record counts grow far past today's seed-scale.
- **List-loader N+1 fetches** — a few list/summary loaders fetch related records per-row instead of in one batched query. Not a correctness issue, a latency one at scale.
- **Accessibility** — most forms don't wire `aria-describedby` from field to its error/help text; most authenticated pages don't render a real `<h1>` (the visible page title isn't always the accessibility-tree heading); a couple of touch targets fall under the 24px minimum. See the Checkpoint 12 accessibility audit for the full list.
- **Database** — the Service Version immutability rule and the `accounting_periods` closed-period lock are both enforced in application code, not backed by a DB trigger, so a direct SQL write could bypass them. A handful of secondary indexes flagged by the Checkpoint 12 database review are not yet added (none are on a hot path today).
- **Operational readiness** — no error-reporting/monitoring SDK (e.g. Sentry) is wired up, no `/api/health` endpoint exists, and no CI pipeline config is committed to the repo (quality gates are run manually/by agent today). None block a first production deploy behind a small, trusted team, but all three should land before wider traffic.
- **Email/SMS delivery** — the notification provider registry (`core/notifications/registry.ts`) is real and provider-agnostic, but no real adapter (SendGrid/Twilio/etc.) is registered yet — Workspace and Client invitations rely on sharing the generated link directly rather than an automated email send.

## Sequencing principle

No phase starts before the previous phase's exit criteria are met and explicitly approved. No module from a later phase is implemented "while we're in there" during an earlier phase.
