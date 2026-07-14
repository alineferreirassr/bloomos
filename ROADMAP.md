# BloomOS Roadmap

This roadmap sequences delivery. It does not repeat business definitions — see `BLOOMOS_BIBLE.md` for those. It does not track day-to-day tasks — see `TODO.md` for those.

## Phase 0 — Foundation (current)

- Repository initialization
- Core documentation (`README.md`, `CLAUDE.md`, `BLOOMOS_BIBLE.md`, this file, `CHANGELOG.md`, `TODO.md`)
- `docs/` specs (database, workflows, ui, automations, integrations, permissions, ai, design-system)
- Technical architecture proposed and approved
- Next.js + TypeScript + Tailwind project scaffolded

**Exit criteria:** architecture approved by the user; project builds and runs locally with an empty shell (no business features yet).

## Phase 1 — MVP

Scope, and only scope: **Dashboard, Leads, Clients, Events, Contracts, Finance.**

1. Data model and mock data layer for the six MVP modules (no live Supabase connection required to start)
2. App shell: navigation, layout, responsive frame (desktop + mobile)
3. Leads — list, detail, create/edit, status
4. Clients — list, detail, create/edit, link to Leads and Events
5. Events — list, detail, lifecycle stage tracking, link to Clients/Contracts/Finance
6. Contracts — list, detail, status, link to Events
7. Finance — deposits/payments, balances, link to Contracts/Events
8. Dashboard — operational overview pulling from the above
9. Supabase connection (only once real credentials exist) — replace mock data layer with live queries, schema/RLS per `docs/database.md` and `docs/permissions.md`

**Exit criteria:** the full Lead → Client → Event → Contract → Deposit slice of the lifecycle is usable end to end for Amoré Bloom, on desktop and mobile, against real (or realistic mock) data.

## Phase 2 — Operational depth

- Inventory
- Suppliers
- Team Management
- Calendar

## Phase 3 — Client-facing & intelligence

- Client Portal
- Bloom AI (assistant)
- Automations
- Email Center

## Phase 4 — Scale

- Analytics
- Knowledge Base
- Multi-tenancy activation (data model already supports it; this phase turns it on for real)

## Sequencing principle

No phase starts before the previous phase's exit criteria are met and explicitly approved. No module from a later phase is implemented "while we're in there" during an earlier phase.
