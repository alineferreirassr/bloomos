# Integrations

This document lists every external system BloomOS touches or will touch, and draws a clear line between what's active now and what's planned. Per `CLAUDE.md`, no integration is connected with fabricated or placeholder credentials — it stays undone until real credentials exist.

## Active

### GitHub
Source control and CI for the BloomOS codebase. Active now.

### Supabase
- **Role:** Postgres database, Auth, Storage.
- **Status:** Connected. A real Supabase project is linked. Every Phase 1 MVP module has real, applied SQL migrations and live RLS policies: the Auth/Workspace foundation (`profiles`/`workspaces`/`workspace_members`), **Leads**, **Clients**, **Events** (+ Checklist/Schedule), the **Shared Media Library** (`media_assets`), **Contracts** (+ Contract Templates/Exhibits), **Finance** (Invoices/Payments/Expenses), and **Documents** (+ Document Folders) — plus the **Team foundation** (`roles`/`permissions`/`role_permissions`/`workspace_invitations`, and the upgraded `workspace_members` policies), the first Phase 2 module — see `docs/database.md` for the full table-by-table breakdown. `NEXT_PUBLIC_DATA_MODE=supabase` reads live data for all of these; `mock` mode (the default) reads none of them and never constructs a Supabase client. See "Data mode" below. No further Phase 1 business-module migration remains, and Team Members + Invitations (the Team foundation) is now live — the next migration phase belongs to a further Phase 2 module (Client Portal, Team Portal, Knowledge Base, Notification Center, Automation Center), none of which are started.
- **Scope at connection time:** Auth (team login), Postgres (MVP schema, migrated incrementally per module), Storage. Storage is **not** per-module — it's the single Shared Media Library (`media_assets` table + the `media-assets` Storage bucket), the canonical backing store every current and future file-bearing module attaches to via polymorphic `owner_type`/`owner_id`, not a separate bucket or table per module. Documents does not own any storage columns of its own (`storage_provider`, `storage_bucket`, `storage_path`, `checksum` are not `documents` table columns) — a Document links to its physical file via a nullable `media_asset_id` FK into `media_assets`, and there is deliberately no independent Documents Storage bucket (an earlier Foundation-phase placeholder `documents` bucket was provisioned, then retired once the Documents migration confirmed it was unused — see `docs/database.md`'s `media_assets` section). Real file upload/download, checksums (real SHA-256, not placeholders), and signed, time-limited download URLs are all live today through the Media Library, for every owner type including Documents.
- **Client factory choice matters per module.** `lib/supabase/server.ts` (used by the Auth/Workspace foundation) depends on `next/headers` and is hard-gated by the `server-only` package — it cannot be imported, even transitively, by any module reachable from a `"use client"` component, or the Next.js build fails. Every business module's UI (Leads, Clients, Events, Contracts, Finance, Documents, and the Media Library) fetches data directly from Client Components, so each Supabase repository (`lib/data/*/supabaseRepository.ts`) and the workspace-session resolver (`lib/auth/workspaceSessionClient.ts`) use the **browser** client (`lib/supabase/client.ts`) instead — RLS is the actual enforcement boundary either way. Any future module migrating a Client-Component-fetched UI should follow the same pattern rather than reusing the server client by default.

#### Data mode

`NEXT_PUBLIC_DATA_MODE` (`.env.example`) is the single switch, read once through `lib/env.ts`:

| Value | Behavior |
|---|---|
| `mock` (default) | Every module — including Auth/Workspace and every business module — runs on in-memory mock data. No Supabase client is ever constructed, no credentials are required, `src/middleware.ts` never redirects. This is the only mode the standard `npm run test`/`npm run build` are expected to pass under. |
| `supabase` | Auth/Workspace foundation and every Phase 1 business module (Leads, Clients, Events, Contracts, Finance, Documents) plus the Shared Media Library and the Team foundation (Team Members + Invitations) read/write live Supabase (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` become required — a clear `SupabaseConfigurationError` is thrown if either is missing). Route protection (`src/middleware.ts`) also activates only in this mode. No business module still falls through to a mock function while this mode is selected. |

Both modes are preserved and independently maintained for every module — mock mode is not a deprecated fallback, it's the default local-development mode with zero external dependencies, and the full test suite runs against it. Business modules migrated to Supabase one at a time through the centralized selection point `lib/data/provider.ts` — never by scattering `NEXT_PUBLIC_DATA_MODE` conditionals through pages or components. Every module follows the same reference pattern Leads (`lib/data/leads/`) established: a `XRepository` interface (`lib/data/x/repository.ts`) implemented once by `mockRepository.ts` and once by `supabaseRepository.ts`, selected via `selectRepository()` inside `lib/data/index.ts`'s thin wrapper functions — no UI file branches on data mode. See `docs/database.md` for each module's own migration details.

#### Required credentials for a live connection

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both public-by-design (Supabase Dashboard → Project Settings → API), safe to expose to client-side JavaScript.
- The Supabase project reference/name, for CLI linking (`npm run supabase:link`).
- **Never** the `service_role` key, the database password, or any access/secret token — no code in this repository requests, stores, or has a slot for any of these today. There is deliberately no service-role client anywhere in the app as of this phase. This includes the live internal Team Members + Invitations flow: token generation/hashing, invitation creation/resend/revoke, and invitation lookup/acceptance all run through RLS-gated statements or two narrowly scoped `security definer` RPCs, never `service_role` — see `docs/permissions.md`'s "Team membership and invitations" section. The one documented, narrow, still-future exception is Client/Team Portal invitation-admin operations (Supabase Auth Admin API calls, which require `service_role`, *if* that future implementation ends up needing them) — server-only, never browser-exposed, never used anywhere else; see `docs/permissions.md`'s "Client and Team Portal invitations" section. Nothing in this exception is implemented.

#### Local Supabase workflow

All commands are `npx`-based (`npm run supabase:*`, `package.json`) — nothing is installed globally:

```
npm run supabase:init            # one-time: scaffold supabase/config.toml
npm run supabase:start           # start local Postgres + Auth + Storage via Docker
npm run supabase:reset           # drop and re-apply every migration in supabase/migrations/, in order
npm run supabase:migration:new   # scaffold a new timestamped migration file
npm run supabase:migration:up    # apply pending migrations to the local instance
npm run supabase:link            # link this repo to a real Supabase project (prompts for project ref)
npm run supabase:push            # push local migrations to the linked remote project — destructive, requires explicit approval before ever being run against a real project
npm run supabase:types           # regenerate src/types/database.types.ts from the linked project's live schema
```

`supabase/migrations/` holds 69 ordered, hand-authored SQL files, one phase at a time: the 8 Supabase Foundation migrations, 5 for Leads, 6 for Clients, 8 for Events (+ Checklist/Schedule), 6 for the Shared Media Library, 8 for Contracts (+ Templates/Exhibits), 8 for Finance (Invoices/Payments/Expenses), 8 for Documents (+ Document Folders), 1 Phase 1 cleanup migration, and 11 for the Team foundation (`roles`/`permissions`/`role_permissions`, the `workspace_members` role extension, `workspace_invitations`, invitation and role/permission helper functions, triggers, indexes, RLS, and seed data). This directory is the source of truth for schema changes, never the Supabase Dashboard's SQL editor or table UI directly — see `docs/database.md` for what each phase's migrations contain.

#### Type generation

`src/types/database.types.ts` is currently a **hand-authored placeholder**, shaped exactly like `supabase gen types typescript` output, covering every table and RPC function from every applied migration (Supabase Foundation through the Team foundation). Run `npm run supabase:types` to overwrite it with the real generated types. `lib/supabase/mappers.ts` is the mapping boundary between these (regenerable) database row types and this app's own hand-maintained domain types — domain types are never replaced by raw row types at a call site.

## Anticipated for future modules (not designed in detail yet)

- **Payment processing** (e.g., Stripe) — for the Finance module to move beyond recording payments manually to actually collecting them. Not in MVP scope; MVP Finance is a ledger, not a payment processor integration.
- **Email delivery** (e.g., Resend, Postmark, or similar) — for the future Email Center and Automations.
- **Calendar sync** (e.g., Google Calendar) — for the future Calendar module.
- **AI provider** (Anthropic/Claude) — for the future Bloom AI assistant; see `docs/ai.md`.

## Principles

- Integrations are added when their owning module's phase begins, not speculatively.
- Every integration boundary is isolated behind an interface in code (e.g., a data-access layer, a mailer interface) so swapping providers later doesn't ripple through business logic.
- Credentials and secrets are never hardcoded or committed; they're environment configuration, supplied by the user when the integration is actually turned on.
- No `service_role` key, database password, or access/secret token is ever requested by an AI agent or checked into this repository — `.env.local` is gitignored, and `.env.example` documents public-only variables.
- No production/remote migration is run without explicit user approval, even once a project is linked (`npm run supabase:push` is destructive against a real project).
- Every Phase 1 business module (Leads/Clients/Events/Contracts/Finance/Documents) and the Team foundation (Team Members + Invitations, the first Phase 2 module) migrated to Supabase this way — one module at a time, each its own explicitly scoped and approved phase, never bundled with unrelated schema changes. Future modules (Client Portal, Team Portal, Knowledge Base, Notification Center, Automation Center) are expected to follow the identical process: connecting the Supabase Foundation, or any other module going live, never moves a different module's business data by itself.
