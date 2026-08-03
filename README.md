# BloomOS

BloomOS is a vertical operating system for luxury event businesses. It manages the complete lifecycle of an event — from first contact to returning client — in one system, purpose-built for the way high-end event studios actually work.

BloomOS is not a generic CRM, not a generic project manager, and not a spreadsheet replacement. It is opinionated software for a specific kind of business, built with the discipline of a real SaaS product from day one.

## The lifecycle

```
Lead → Client → Consultation → Proposal → Contract → Deposit
     → Planning → Inventory → Team → Event Execution
     → Gallery → Feedback → Returning Client
```

Every module in BloomOS exists to serve one or more stages of this lifecycle. See [`BLOOMOS_BIBLE.md`](./BLOOMOS_BIBLE.md) for the full domain model.

## First customer

The first company operating on BloomOS is **Amoré Bloom**, a luxury proposal and event planning company based in California. Amoré Bloom's real operating needs drive the MVP, but BloomOS is architected as a standalone, multi-tenant-ready SaaS product — not a custom internal tool for a single client.

## Project status

**v1.0.0 released.** Leads, Clients, Events, Contracts, Finance, and Documents are fully live against a real, connected Supabase project (Auth, Workspace membership, granular permissions, RLS on every table). Team Portal (permission-aware internal app shell) and Client Portal (external client-facing Events/Contracts/Invoices/Documents) are both complete. Phase 2 added Core cross-module infrastructure (Notes/Timeline/Tags/Comments/Files/Audit Log/Search), Inventory, Vendors, Purchases, Finance Reports, and the large Services module (catalog, versioning, Templates, Event Assignment, per-Event Workspace), plus Bloom AI's first shipped feature (the Event Operations Brief). The Commercial Pipeline board is live; the Operational Pipeline board and Booking Dashboard remain in progress for Phase 2's continuation. See [`RELEASE_NOTES.md`](./RELEASE_NOTES.md) for the v1.0.0 release summary and known limitations, [`ROADMAP.md`](./ROADMAP.md) for the phased plan, and [`TODO.md`](./TODO.md) for the current checklist.

## Stack

- **Next.js** (App Router) + **TypeScript** (strict)
- **Tailwind CSS**
- **Supabase** (Postgres, Auth, Storage) — foundation built (`@supabase/ssr`), connected only once real credentials exist; see "Running locally" below
- **GitHub** for source control and CI

No unnecessary dependencies. Every library added must earn its place.

## Architecture at a glance

**Folder structure** (`src/`):

| Path | Contains |
|---|---|
| `app/` | Next.js App Router routes — thin `page.tsx` wrappers around a `modules/*` view, plus route groups for auth/client-portal separation |
| `modules/` | One directory per business module (`components/`, `schema.ts`, module-specific hooks/helpers) — see the module map below |
| `core/` | Cross-module shared architecture: enums, workflows, errors, permissions/guards, and the Core foundation domains (Notes/Timeline/Tags/Comments/Files/Audit Log/Search/Notifications/AI-provider) every module builds on |
| `lib/` | Data-access layer (`lib/data/<module>/{repository,mockRepository,supabaseRepository}.ts` per module, selected by `lib/data/provider.ts`), Supabase client factories, auth, money/date helpers |
| `components/` | Shared UI primitives (`ui/`) and cross-cutting providers |
| `config/` | `navigation.ts` — the single source of truth for the sidebar/mobile-nav structure |
| `types/` | Canonical domain types, one file per entity |
| `features/`, `automation/`, `audit/`, `email/`, `services/` | Reserved placeholders for post-MVP modules (Automation Center, standalone Email Center, etc.) — no business logic yet |

**Module map** (`src/modules/`): `leads`, `clients`, `events`, `contracts`, `finance`, `documents` (Phase 1 MVP); `team`, `clientAccess`, `clientPortal`, `account` (Team/Client Portal); `pipeline` (Commercial + Operational Pipeline boards); `inventory`, `vendors`, `purchases`, `services` (Operational depth); `notes`, `timeline`, `checklist`, `ai`, `dashboard` (shared/cross-cutting front doors). Each module owns its own `components/`; most also own a `schema.ts` (zod validation) and, where relevant, a `core/workflows/<module>Workflow.ts` (pure lifecycle rules).

**Navigation map**: `config/navigation.ts`'s `navigationModules` array is the single data-driven source the Sidebar, MobileNav, and TopBar all render from — never hand-duplicated per surface. Modules are grouped as Dashboard, CRM (Leads/Clients/Commercial Pipeline/Contracts/Client Accounts/Client Invitations), Events (Events/Operational Pipeline), then flat top-level entries for Inventory/Vendors/Purchases/Finance/Documents/Team/Services, and two still-`disabled` placeholders (Bloom AI, Settings) that render in the permanent structure without a live route. Visibility is permission-filtered per member via `getVisibleNavigationModules()` — see `docs/permissions.md`.

## Running locally

```
npm install
npm run dev
```

No environment configuration is required by default — the app runs entirely on an in-memory mock data layer (`NEXT_PUBLIC_DATA_MODE=mock`, the default), useful for UI work with no database dependency. To run against the real, connected Supabase project instead:

```
cp .env.example .env.local
# set NEXT_PUBLIC_DATA_MODE=supabase and both NEXT_PUBLIC_SUPABASE_* values
```

Every business module (Leads/Clients/Events/Contracts/Finance/Documents, Team, Client Accounts/Portal, Inventory, Vendors, Purchases, Services) has a live Supabase repository and switches over with this one setting — see [`docs/integrations.md`](./docs/integrations.md) for the full data-mode model and the local Supabase CLI workflow (`npm run supabase:*`).

```
npm run lint
npm run typecheck
npm run test
npm run build
```

## Documentation map

| File | Purpose |
|---|---|
| [`CLAUDE.md`](./CLAUDE.md) | Permanent operating instructions for AI agents and engineers working in this repo |
| [`BLOOMOS_BIBLE.md`](./BLOOMOS_BIBLE.md) | Source of truth for the domain model, lifecycle, and Workspace concept |
| [`PRODUCT_PRINCIPLES.md`](./PRODUCT_PRINCIPLES.md) | Long-term product philosophy — the tiebreaker when a decision isn't settled elsewhere |
| [`ROADMAP.md`](./ROADMAP.md) | Phased delivery plan, MVP scope, future modules |
| [`CHANGELOG.md`](./CHANGELOG.md) | Notable changes, by version |
| [`RELEASE_NOTES.md`](./RELEASE_NOTES.md) | v1.0.0 release summary, upgrade/deployment notes, known limitations |
| [`TODO.md`](./TODO.md) | Current, actionable task list |
| [`docs/database.md`](./docs/database.md) | Data model and schema design |
| [`docs/workflows.md`](./docs/workflows.md) | Lifecycle stages, transitions, business rules |
| [`docs/ui.md`](./docs/ui.md) | Screen inventory and UI states |
| [`docs/automations.md`](./docs/automations.md) | Automation rules (future module) |
| [`docs/integrations.md`](./docs/integrations.md) | External services and integration boundaries |
| [`docs/permissions.md`](./docs/permissions.md) | Roles, access control, RLS strategy |
| [`docs/ai.md`](./docs/ai.md) | Bloom AI — shipped Event Operations Brief, architecture, guardrails, deferred capabilities |
| [`docs/design-system.md`](./docs/design-system.md) | Visual and interaction principles |
| [`docs/testing.md`](./docs/testing.md) | Test infrastructure, coverage baseline/thresholds, flaky-test history |
| [`docs/inventory.md`](./docs/inventory.md) | Inventory module — items, movements, condition/status workflow |
| [`docs/purchases.md`](./docs/purchases.md) | Purchases module — Purchase/PurchaseItem lifecycle, receiving |
| [`docs/finance-reports.md`](./docs/finance-reports.md) | Finance Reports — General Ledger, Trial Balance, P&L, Balance Sheet |
| [`docs/services.md`](./docs/services.md) | Services module — catalog, Templates, Event Assignment |
| [`docs/design-system-v2.md`](./docs/design-system-v2.md) | Component/layout/responsive conventions (additive to `docs/design-system.md`) |
| [`docs/v2-checkpoint-1-foundation.md`](./docs/v2-checkpoint-1-foundation.md) | v2.0 foundation architecture — Command Palette, Search pipeline, Calendar, Notifications, Feature Flags, Observability, CI/CD |

## Philosophy

Every feature must either save time, reduce mistakes, improve the client experience, or increase operational efficiency. The product should feel premium, elegant, and extremely intuitive — inspired by Apple, Linear, Notion, and Stripe. We build BloomOS like a SaaS company, not like a custom internal tool.

## License

Proprietary. All rights reserved.
