# Permissions

Access control model for BloomOS. Most of this document is written ahead of a live Supabase connection — RLS policies below are the intended design, not yet applied to a real database. The exception is the **Supabase Foundation** (`profiles`/`workspaces`/`workspace_members`, `feature/supabase-foundation`): RLS for those three tables is written, reviewed, and ready in `supabase/migrations/` — see "Supabase Foundation RLS (ready, not yet live)" below — but still not applied to any real database, since no Supabase project is connected. No business-module table (Leads/Clients/Events/Contracts/Finance/Documents) has RLS yet.

## Auth foundation (email/password only)

`lib/auth/` provides sign in, sign out, session retrieval, current-user retrieval, password reset request, and password update — all normalized through `lib/supabase/errors.ts` so a raw Supabase/Postgres error never reaches the UI. This is infrastructure, not a finished product surface:

- **Email/password only.** No social providers are enabled.
- **No public signup.** There is no "create an account" flow for arbitrary visitors — the first owner/admin account and its Workspace row are created manually via the Supabase Dashboard/SQL once real credentials exist (see `docs/integrations.md`).
- **No invitations yet.** Adding a second `workspace_members` row for a teammate is a manual/SQL operation for now; an invitation flow is future scope.
- **Minimal pages, not final UI.** `/sign-in`, `/reset-password`, `/update-password` exist so the Auth foundation is exercisable end-to-end, but are not the polished Auth experience the product will ship.
- **`getCurrentUser()` over `getSession()`** for anything auth-gating — it revalidates the token against Supabase Auth rather than trusting the session cookie alone (`lib/auth/session.ts`).
- **Route protection is opt-in this phase.** `src/middleware.ts` only redirects unauthenticated visitors away from protected routes (`/dashboard`, `/leads`, `/clients`, `/events`, `/contracts`, `/finance`, `/documents`) when `NEXT_PUBLIC_DATA_MODE=supabase`. In `mock` mode (the default), every route is open and local development never requires a login — see `docs/integrations.md`.

## Workspace membership model

`workspace_members` carries a `role` and a `status` per (`workspace_id`, `user_id`) pair (unique constraint):

| Role | Intent |
|---|---|
| `owner` | Full control, including Workspace settings and membership management. |
| `admin` | Same practical access as `owner` for day-to-day purposes; both are the only roles permitted to update Workspace settings or manage memberships in the RLS policies below. |
| `manager` | Reserved for a future finer-grained permission tier — no policy distinguishes it from `team` yet. |
| `team` | Operational member — the eventual Postgres-level equivalent of today's "Team Member" MVP role below. |
| `viewer` | Reserved for future read-only access — no policy distinguishes it from `team` yet. |

| Status | Effect |
|---|---|
| `active` | Normal access, gated by role. |
| `invited` | Not yet active — every RLS membership check (`is_workspace_member()`, `has_workspace_role()`) requires `status = 'active'`, so an `invited` row grants no access yet. |
| `suspended` | Explicitly locked out — same mechanism as `invited`: fails every membership check without needing a separate "disabled" concept. |

The MVP *UI* assumes one active Workspace per session (`CURRENT_WORKSPACE_ID`, `core/constants/workspace.ts`), but the schema already supports a user belonging to several Workspaces — `current_user_workspace_ids()` returns all of them.

## MVP roles

The MVP runs for a single Workspace (Amoré Bloom — see `BLOOMOS_BIBLE.md` §7) with a small team, so the role model is intentionally minimal:

| Role | Description |
|---|---|
| **Owner/Admin** | Full access to all MVP modules: Dashboard, Leads, Clients, Events, Contracts, Finance, Documents. Can manage team access. |
| **Team Member** | Operational access to Leads, Clients, Events, Contracts, Finance, Documents for day-to-day work. No account/billing administration. |

No client-facing role exists in the MVP — the future **Client Portal** module (Phase 3) introduces an external, scoped-down role for clients to view their own event only, and the future **Team Portal** introduces a scoped-down internal role for team members who aren't full Owner/Admin/Team Member users (e.g. day-of staff or contractors). Both are expected to read `documents.visibility`/`document_folders.visibility` once they exist (see "Documents visibility" below) — no such access exists yet.

## Guiding rules

- **Workspace-scoped by default.** Every query is implicitly scoped to `workspace_id` (see `docs/database.md`), even with a single tenant today — this is what makes multi-tenancy a flip of a switch later, not a rebuild.
- **No cross-tenant visibility, ever** — even before multi-tenancy is "on," the data model and access rules behave as if other tenants already exist.
- **Least privilege.** A role gets exactly the modules its job requires. The future Client Portal role, for example, sees only its own event's data — never other clients, never internal notes.

## Supabase Foundation RLS (ready, not yet live)

`supabase/migrations/20260715150600_rls_enablement.sql` enables RLS and defines every policy below on `profiles`, `workspaces`, and `workspace_members`. Written and reviewed; not yet applied to any real database (no Supabase project is connected). No policy anywhere in this migration uses a bare `using (true)` — every rule is scoped to the requesting user's own row or their actual, active Workspace membership, and every policy is scoped `to authenticated` (so an anonymous/unauthenticated request, where `auth.uid()` is `null`, is rejected by every check below, not just implicitly).

| Table | Policy | Rule |
|---|---|---|
| `profiles` | select/update own | `id = auth.uid()` — a user reads/updates only their own profile row. No insert/delete policy: rows are created only by the `handle_new_user()` trigger, never removed while the `auth.users` row exists. |
| `workspaces` | select | Any user with an **active** membership (`is_workspace_member(id)`) may read the Workspace row. |
| `workspaces` | update | Only `owner`/`admin` (`has_workspace_role(id, ['owner','admin'])`) may update Workspace settings. No delete policy — archival is via `archived_at`, never physical delete. No insert policy this phase (see "Auth foundation" above — Workspace creation is manual). |
| `workspace_members` | select | Any active member of the same Workspace may read its membership rows (the team roster is visible to the whole team, not just owner/admin). |
| `workspace_members` | insert/update/delete | Only `owner`/`admin` of that Workspace may manage memberships. |

Three reusable SQL helper functions back every check above (`supabase/migrations/20260715150500_workspace_membership_helpers.sql`):

- **`is_workspace_member(workspace_uuid)`** — true iff `auth.uid()` has an `active` membership in the given Workspace.
- **`has_workspace_role(workspace_uuid, allowed_roles)`** — true iff `auth.uid()` has an `active` membership with a role in `allowed_roles`.
- **`current_user_workspace_ids()`** — every Workspace id `auth.uid()` actively belongs to.

All three are `security definer` — deliberately, and only here: without it, evaluating a membership check from inside a `workspace_members` policy would recurse into `workspace_members`' own RLS to answer the membership question. Every one pins `set search_path = public` (a `security definer` function with a mutable `search_path` is a documented Postgres privilege-escalation vector) and is marked `stable`, matching the planner's expectations for a function called from inside a policy. `lib/auth/workspaceRoles.ts` provides pure, client-safe TypeScript mirrors of the same three functions for UI-side decisions from membership rows already in hand — these never replace RLS as the actual enforcement boundary; the database remains the source of truth.

A `suspended` (or still-`invited`) member fails every one of these checks automatically, since each requires `status = 'active'` — no separate "disabled account" flag exists or is needed.

## Supabase Row-Level Security for business tables (planned)

Once Supabase is connected and a business module's own migration phase begins (see `docs/integrations.md`), RLS policies for that module are expected to enforce:

- Every table with `workspace_id` — a row is only visible/writable to authenticated users belonging to that `workspace_id`, using the same `is_workspace_member()`/`has_workspace_role()` helpers documented above rather than duplicating the check.
- `Owner/Admin` vs `Team Member` distinctions enforced via `workspace_members.role`, checked in policy, not in application code alone.
- The future Client Portal role restricted, at the policy level, to its own `client_id`'s and linked `event_id`'s rows only — never a broader query.

## Storage Foundation (buckets ready, no upload UI yet)

`supabase/migrations/20260715150700_storage_buckets_and_policies.sql` creates two **private** (`public = false`) Storage buckets and their `storage.objects` policies — infrastructure only. No upload UI exists yet and no Documents metadata is migrated to Supabase in this phase (see `docs/integrations.md`).

| Bucket | Path convention | Access rule |
|---|---|---|
| `documents` | `{workspace_id}/{owner_type}/{owner_id}/{document_id}/{file_name}` | select/insert/update/delete require `is_workspace_member()` on the path's first segment (the `workspace_id`), parsed via `storage.foldername(name)`. |
| `avatars` | `{user_id}/{file_name}` | select/insert/update/delete require the path's first segment to equal `auth.uid()`. |

Neither bucket permits anonymous read, and neither is ever expected to hand out a permanent public URL. The intended future access model is **short-lived signed URLs**, generated per-request and scoped to the requester's already-established Workspace membership/role — never a bare public bucket URL embedded in a page. This mirrors the same principle already documented for the Documents domain below.

## Documents visibility (metadata only in this phase)

`documents.visibility`/`document_folders.visibility` (`internal`, `client`, `team`, `client_and_team`, `restricted` — `core/enums/documentVisibility.ts`) describe *intended* audience today, nothing more — no authentication or access-control code reads these values yet, and every Document is reachable through the data layer by any caller regardless of its `visibility`. This is deliberate groundwork, not a gap being papered over: the security architecture is designed now so the enforcement layer has a real field to key off once it exists, rather than retrofitting visibility onto Documents after the fact.

Security principles this domain is built around, ahead of enforcement:

- **Metadata and binary storage are separated.** A `documents` row is queryable/listable without ever touching the storage backend; the storage backend is never queried without going through a `documents` row first.
- **No document is public by default.** The narrowest practical `visibility` (`internal`) is the schema default expectation; nothing here defaults to a public/unauthenticated read.
- **No permanent public file URLs.** `storage_path` is an internal reference, never a URL handed to a browser directly — once Supabase Storage connects, access is expected to go through short-lived signed URLs (see `docs/integrations.md`), generated per-request and scoped to the requester's role.
- **Workspace isolation.** Every Document/Folder query is scoped by `workspace_id` in addition to `owner_type`/`owner_id`, the same polymorphic-ownership discipline as `notes`/`timeline_activities` (`docs/database.md`).
- **Soft deletion, not physical deletion.** A `deleted` Document remains in the store and auditable; nothing is unrecoverably destroyed by this domain.
- **Audit trail.** Every lifecycle transition (created, activated, versioned, superseded, expired, archived, restored, soft-deleted, visibility changed, moved to folder) is recorded on the Document's own Timeline (`owner_type = 'document'`) — see `docs/workflows.md`'s Documents section.
- **Checksums exist for future integrity verification**, not enforced today — `checksum` is a deterministic placeholder derived from file metadata, not a hash of real file bytes (none exist yet).
- **No executable uploads, ever.** `exe`/`dmg`/`pkg`/`app`/`js`/`sh`/`bat`/`cmd` are blocked at the schema/helper level (`lib/documentFile.ts`) regardless of role or visibility.
- **No file contents are stored in application records.** `documents` rows are metadata only in this phase — see `docs/database.md`.
- **No client-visible access without an explicit `visibility` value permitting it**, once enforcement exists — the default should never accidentally expose an internal document to a future Client Portal session.

Once Supabase RLS is connected, `documents`/`document_folders` policies are expected to layer on top of the `workspace_id` check every other table gets (see "Supabase Row-Level Security" above): a `client` or `client_and_team`-visible row readable by the Client Portal role scoped to its own `client_id`/`event_id`, a `team`/`client_and_team`-visible row readable by the Team Portal role, and `internal`/`restricted` rows never exposed outside Owner/Admin/Team Member.

## Explicitly out of scope for now

- Granular per-field permissions
- Custom/configurable roles
- Any client-facing access (until Client Portal, Phase 3)
- Enforcing `documents`/`document_folders` `visibility` at the data-layer or RLS level (metadata only until real auth exists)
- Real file upload, signed URLs, or migrating any Documents metadata to Supabase — the `documents`/`avatars` Storage buckets and their access policies exist (see "Storage Foundation" above) but nothing uploads to them yet
