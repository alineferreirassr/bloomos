# Integrations

This document lists every external system BloomOS touches or will touch, and draws a clear line between what's active now and what's planned. Per `CLAUDE.md`, no integration is connected with fabricated or placeholder credentials — it stays undone until real credentials exist.

## Active

### GitHub
Source control and CI for the BloomOS codebase. Active now.

### Supabase
- **Role:** Postgres database, Auth, Storage.
- **Status:** Connected. A real Supabase project is linked; the Auth/Workspace foundation (`profiles`/`workspaces`/`workspace_members`, 8 migrations) and the **Leads** module (`leads`/`notes`/`timeline_activities`, 5 migrations) both have real, applied SQL migrations and live RLS policies. `NEXT_PUBLIC_DATA_MODE=supabase` reads live data for Auth/Workspace and Leads; every other business module (Clients/Events/Contracts/Finance/Documents) still runs entirely on the mock data layer (mirroring `docs/database.md`) regardless of this setting, migrated one at a time through `lib/data/provider.ts`. See "Data mode" below.
- **Scope at connection time:** Auth (team login), Postgres (MVP schema, migrated incrementally per module), Storage (the Documents domain's real backing store — every mock Document already carries a `storage_provider`/`storage_bucket`/`storage_path` triple shaped for this; connecting Supabase Storage is expected to mean writing real objects at those paths and switching `storage_provider` from `"mock"` to `"supabase"`, not a schema change. Signed, time-limited URLs are expected to replace any notion of a permanent public file URL — the Documents domain's `visibility` field is metadata only until this connects, see `docs/permissions.md`).
- **Client factory choice matters per module.** `lib/supabase/server.ts` (used by the Auth/Workspace foundation) depends on `next/headers` and is hard-gated by the `server-only` package — it cannot be imported, even transitively, by any module reachable from a `"use client"` component, or the Next.js build fails. Leads' UI (`LeadsListView`, `LeadDetailView`, etc.) fetches data directly from Client Components, so its Supabase repository (`lib/data/leads/supabaseRepository.ts`) and workspace-session resolver (`lib/auth/workspaceSessionClient.ts`) use the **browser** client (`lib/supabase/client.ts`) instead — RLS is the actual enforcement boundary either way. Any future module migrating a Client-Component-fetched UI should follow the same pattern rather than reusing the server client by default.

#### Data mode

`NEXT_PUBLIC_DATA_MODE` (`.env.example`) is the single switch, read once through `lib/env.ts`:

| Value | Behavior |
|---|---|
| `mock` (default) | Every module — including Auth/Workspace — runs on in-memory mock data. No Supabase client is ever constructed, no credentials are required, `src/middleware.ts` never redirects. This is the only mode the standard `npm run test`/`npm run build` are expected to pass under. |
| `supabase` | Auth/Workspace foundation and the **Leads** module read live Supabase (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` become required — a clear `SupabaseConfigurationError` is thrown if either is missing). Every other business module is **unaffected**: `lib/data/index.ts` calls their original mock functions directly regardless of this setting. Route protection (`src/middleware.ts`) also activates only in this mode. |

Business modules migrate to Supabase one at a time through the centralized selection point `lib/data/provider.ts` — never by scattering `NEXT_PUBLIC_DATA_MODE` conditionals through pages or components. Leads (`lib/data/leads/`) is the reference implementation of this pattern: a `LeadsRepository` interface (`lib/data/leads/repository.ts`) implemented once by `mockRepository.ts` and once by `supabaseRepository.ts`, selected via `selectRepository()` inside `lib/data/index.ts`'s thin wrapper functions — no UI file branches on data mode.

#### Required credentials for a live connection

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — both public-by-design (Supabase Dashboard → Project Settings → API), safe to expose to client-side JavaScript.
- The Supabase project reference/name, for CLI linking (`npm run supabase:link`).
- **Never** the `service_role` key, the database password, or any access/secret token — no code in this repository requests, stores, or has a slot for any of these. There is deliberately no service-role client anywhere in the app.

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

`supabase/migrations/` holds 13 ordered, hand-authored SQL files: the 8 Supabase Foundation migrations (extensions/helpers → profiles → workspaces → workspace_members → shared `updated_at` trigger → Workspace-membership RLS helper functions → RLS enablement → Storage buckets/policies), followed by the 5 Leads migrations (`leads` table → `notes` table → `timeline_activities` table → `updated_at` triggers for `leads`/`notes` → RLS enablement). This directory is the source of truth for schema changes, never the Supabase Dashboard's SQL editor or table UI directly.

#### Type generation

`src/types/database.types.ts` is currently a **hand-authored placeholder**, shaped exactly like `supabase gen types typescript` output, covering the three Supabase Foundation tables plus `leads`/`notes`/`timeline_activities`. Run `npm run supabase:types` to overwrite it with the real generated types. `lib/supabase/mappers.ts` is the mapping boundary between these (regenerable) database row types and this app's own hand-maintained domain types (`src/types/profile.ts`, `workspace.ts`, `workspaceMember.ts`, `lead.ts`, `note.ts`, `timelineActivity.ts`) — domain types are never replaced by raw row types at a call site.

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
- Business modules (Leads/Clients/Events/Contracts/Finance/Documents) stay on their mock repositories until each module's own migration phase is explicitly scoped and approved — connecting the Supabase Foundation does not, by itself, move any business data.
