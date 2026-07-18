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
- Inventory
- Suppliers
- Calendar

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

## Sequencing principle

No phase starts before the previous phase's exit criteria are met and explicitly approved. No module from a later phase is implemented "while we're in there" during an earlier phase.
