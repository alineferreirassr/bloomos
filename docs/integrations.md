# Integrations

This document lists every external system BloomOS touches or will touch, and draws a clear line between what's active now and what's planned. Per `CLAUDE.md`, no integration is connected with fabricated or placeholder credentials — it stays undone until real credentials exist.

## Active

### GitHub
Source control and CI for the BloomOS codebase. Active now.

## Planned, not yet connected

### Supabase
- **Role:** Postgres database, Auth, Storage.
- **Status:** Foundation built, not connected. `feature/supabase-foundation` added the client factories, Auth foundation, Workspace membership schema (`profiles`/`workspaces`/`workspace_members`), RLS policies, and Storage bucket policies described below — but no real Supabase project is linked, no migration has been applied to a live database, and `NEXT_PUBLIC_DATA_MODE` defaults to `mock`. Every business module (Leads/Clients/Events/Contracts/Finance/Documents) still runs entirely on the mock data layer (mirroring `docs/database.md`) regardless of this setting; only the Auth/Workspace foundation itself is wired to read live Supabase once configured. See "Data mode" below.
- **Scope at connection time:** Auth (team login), Postgres (MVP schema), Storage (the Documents domain's real backing store — every mock Document already carries a `storage_provider`/`storage_bucket`/`storage_path` triple shaped for this; connecting Supabase Storage is expected to mean writing real objects at those paths and switching `storage_provider` from `"mock"` to `"supabase"`, not a schema change. Signed, time-limited URLs are expected to replace any notion of a permanent public file URL — the Documents domain's `visibility` field is metadata only until this connects, see `docs/permissions.md`).

#### Data mode

`NEXT_PUBLIC_DATA_MODE` (`.env.example`) is the single switch, read once through `lib/env.ts`:

| Value | Behavior |
|---|---|
| `mock` (default) | Every module — including Auth/Workspace — runs on in-memory mock data. No Supabase client is ever constructed, no credentials are required, `src/middleware.ts` never redirects. This is the only mode the standard `npm run test`/`npm run build` are expected to pass under. |
| `supabase` | Auth/Workspace foundation reads live Supabase (`NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` become required — a clear `SupabaseConfigurationError` is thrown if either is missing). Business modules are **unaffected**: `lib/data/index.ts` remains their sole implementation this phase, called directly regardless of this setting. Route protection (`src/middleware.ts`) also activates only in this mode. |

Business modules migrate to Supabase one at a time, in a later phase, through the centralized selection point `lib/data/provider.ts` — never by scattering `NEXT_PUBLIC_DATA_MODE` conditionals through pages or components.

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

`supabase/migrations/` holds 8 ordered, hand-authored SQL files (extensions/helpers → profiles → workspaces → workspace_members → shared `updated_at` trigger → Workspace-membership RLS helper functions → RLS enablement → Storage buckets/policies) — this directory is the source of truth for schema changes, never the Supabase Dashboard's SQL editor or table UI directly.

#### Type generation

`src/types/database.types.ts` is currently a **hand-authored placeholder**, shaped exactly like `supabase gen types typescript` output, covering the three Supabase Foundation tables. Once a project is linked, run `npm run supabase:types` to overwrite it with the real generated types. `lib/supabase/mappers.ts` is the mapping boundary between these (regenerable) database row types and this app's own hand-maintained domain types (`src/types/profile.ts`, `workspace.ts`, `workspaceMember.ts`) — domain types are never replaced by raw row types at a call site.

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
