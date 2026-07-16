# Permissions

Access control model for BloomOS. Most of this document is written ahead of a live Supabase connection — RLS policies below are the intended design, not yet applied to a real database. The exception is the **Supabase Foundation** (`profiles`/`workspaces`/`workspace_members`, `feature/supabase-foundation`): RLS for those three tables is written, reviewed, and ready in `supabase/migrations/` — see "Supabase Foundation RLS (ready, not yet live)" below — but still not applied to any real database, since no Supabase project is connected. No business-module table (Leads/Clients/Events/Contracts/Finance/Documents) has RLS yet.

## Auth foundation (email/password only)

`lib/auth/` provides sign in, sign out, session retrieval, current-user retrieval, password reset request, and password update — all normalized through `lib/supabase/errors.ts` so a raw Supabase/Postgres error never reaches the UI. This is infrastructure, not a finished product surface:

- **Email/password only.** No social providers are enabled.
- **No public signup.** There is no "create an account" flow for arbitrary visitors — the first owner/admin account and its Workspace row are created manually via the Supabase Dashboard/SQL once real credentials exist (see `docs/integrations.md`).
- **No invitations yet.** Adding a second `workspace_members` row for a teammate is a manual/SQL operation for now; the invitation-link architecture is documented below ("Client and Team Portal invitations") but not implemented — no invitation UI, no email sending, no `invitations` table exists yet.
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

## Client and Team Portal invitations (architecture, planned — not implemented)

**This is a permanent BloomOS principle, documented ahead of Client Portal/Team Portal implementation.** No invitation UI, invitation-sending code, `invitations` table, or activation page exists yet — nothing below changes current application behavior. This section exists so the eventual implementation follows one settled design rather than being decided ad hoc when Client Portal/Team Portal work begins.

**The core rule: BloomOS never generates, emails, or displays a temporary password, for any portal, ever.** Every Client Portal and Team Portal account is provisioned through a single-use Supabase Auth invitation link. The recipient — never BloomOS or a BloomOS administrator — is the only party who ever sets their own password.

### Required flow

1. An authorized Workspace owner/admin creates an invitation specifying: recipient email, recipient name, portal type (Client Portal or Team Portal), Workspace, role, permissions, and an optional related `clients` or `team_members` record to link the invitation to.
2. The invitation/membership row is created with status `invited` — consistent with how `workspace_members.status = 'invited'` already works today (see "Workspace membership model" above): an `invited` row grants no access until it becomes `active`.
3. A single-use Supabase Auth invitation link is sent to the recipient (`supabase.auth.admin.inviteUserByEmail()` or equivalent) — this is the only mechanism that ever reaches the recipient; BloomOS never constructs, stores, or transmits a password on their behalf.
4. The recipient follows the link to a branded Amoré Bloom activation page (not a generic Supabase page).
5. The recipient sets their own password on that activation page. This is the first and only time a password for that account is chosen — by the recipient, never by BloomOS.
6. On successful password creation: the invitation is marked `accepted`, the corresponding membership is activated (`status = 'active'`), and the recipient is redirected to the correct portal for their portal type/role.

### Never

- Generate a temporary password.
- Send a password by email, SMS, or any other channel.
- Display a password to an administrator, in any UI, log, or export.
- Store a plaintext password anywhere (Supabase Auth already handles password hashing; no BloomOS code ever needs to see, store, or compare a raw password).
- Log a password, anywhere, at any log level.
- Expose admin/service-role authentication credentials in frontend code (see "Server-only administrative operations" below).

### Invitation statuses

`invited` → `sent` → `accepted`, with `expired` and `revoked` as terminal off-ramps from `sent` (an already-`accepted` invitation is never expired or revoked — only the underlying membership can later be suspended, via the existing `workspace_members.status` mechanism). This mirrors the terminal-status pattern already used by Leads (`core/workflows/leadWorkflow.ts`) and other modules — canonical values and transition rules belong in a future `core/workflows/invitationWorkflow.ts`, not duplicated here. See `docs/workflows.md`'s "Invitation lifecycle" section.

### Required supporting operations

- **Resend** — re-sends the invitation link without creating a duplicate invitation row; expected to move status back to `sent` and reset expiration.
- **Revoke** — administrator-initiated, moves status to `revoked`, invalidates the link.
- **Expiration** — invitations are time-limited; an unaccepted invitation past its expiration is `expired`, not silently left as `sent` forever.
- **Existing-user handling** — if the invited email already has a Supabase Auth account (e.g. inviting the same person to a second Workspace, or to both a Client and Team Portal), the flow must detect this and add the new membership to the existing account rather than erroring or creating a duplicate `auth.users` row.
- **Password recovery for existing users** — unrelated to invitation acceptance; reuses the existing `requestPasswordReset()`/`updatePassword()` flow (`lib/auth/actions.ts`) already built in the Supabase Foundation.
- **Audit Timeline entries** — every invitation lifecycle transition (created, sent, resent, accepted, expired, revoked) is expected to record a Timeline entry, following the same `recordTimelineActivity` mechanism every other module already uses (`docs/workflows.md`) — never constructed by hand.

### Client Portal vs. Team Portal

The two portal types are never conflated: an invitation is for exactly one portal type, and Client Portal and Team Portal accounts are expected to receive **different `workspace_members`-equivalent memberships, different roles, different permissions, and different post-activation redirect destinations** — a Client Portal invitation never grants Team Portal access and vice versa, even for the same email address (see "Existing-user handling" above for the case where one person legitimately needs both).

### Server-only administrative operations

Sending, resending, and revoking an invitation (and any other Supabase Auth Admin API call) requires the Supabase `service_role` key — the Admin API is not reachable with the publishable/anon key used everywhere else in this app. This is a **narrow, deliberate, server-only exception** to this codebase's otherwise-absolute "no service-role client anywhere in the app" rule (`docs/integrations.md`):

- A `service_role` client, if and when built, is expected to live in its own dedicated server-only module (e.g. `lib/supabase/admin.ts`, gated by `import "server-only"` exactly like `lib/supabase/server.ts` already is), used **only** by invitation-admin Server Actions/Route Handlers — never imported by any other module, and never by anything reachable from a Client Component (see `docs/integrations.md`'s "Client factory choice matters per module" note — the same `server-only` bundling boundary that already governs `lib/supabase/server.ts` applies here, with even higher stakes given the elevated key).
- The `service_role` key itself follows every existing credential rule (`docs/integrations.md`): never committed, never logged, never printed, never present in any `NEXT_PUBLIC_*` variable, never returned to or constructed in browser code.
- No other part of the app — Leads, Clients, Events, Contracts, Finance, Documents, or any future module's own Supabase migration — needs or is expected to ever touch `service_role`. This exception is scoped exclusively to invitation-admin operations.

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

## Supabase RLS for Leads (live)

`supabase/migrations/20260716100400_leads_rls.sql` enables RLS and defines every policy below on `leads`, `notes`, and `timeline_activities`. Applied to a live, connected Supabase project. Same rules as the Foundation RLS above — no bare `using (true)`, every policy scoped `to authenticated`.

| Table | Policy | Rule |
|---|---|---|
| `leads` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's Leads — **Workspace isolation only**, no `owner`/`admin` role gating (unlike `workspaces`/`workspace_members` above). No delete policy — archival is via `status = 'archived'` + `archived_at`, never physical delete. |
| `notes` | select/insert/update | Same `is_workspace_member(workspace_id)` rule, scoped further at the `CHECK` constraint level to `owner_type in ('lead', 'client')` as of the Clients migration (see `docs/database.md`). No delete policy. |
| `timeline_activities` | select/insert | Same `is_workspace_member(workspace_id)` rule. No update or delete policy — every entry is immutable and append-only. |

This is the first business-module RLS policy set built on top of the Foundation's `is_workspace_member()` helper — no new SQL function was needed. `lib/data/leads/supabaseRepository.ts` (the Leads module's Supabase repository) uses the **browser** Supabase client (`lib/supabase/client.ts`), not the server one, since the Leads UI fetches from Client Components — RLS is what actually enforces every rule above regardless of which client issues the query; see `docs/integrations.md`'s "Client factory choice matters per module" note.

## Supabase RLS for Clients (live)

`supabase/migrations/20260717100300_clients_rls.sql` enables RLS and defines the policy below on `clients`. Applied to a live, connected Supabase project. Same rules as Leads above — no bare `using (true)`, every policy scoped `to authenticated`.

| Table | Policy | Rule |
|---|---|---|
| `clients` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's Clients — **Workspace isolation only**, same as `leads`, no `owner`/`admin` role gating. No delete policy — archival is via `internal_status = 'archived'` + `archived_at`, and (unlike Leads) is reversible via `restoreClient`. |

`notes`/`timeline_activities` needed no new policies for Client-owned rows — their existing `is_workspace_member(workspace_id)` policies (above) already cover any `owner_type`; only the `CHECK` constraint governing which `owner_type` values are accepted needed widening (`docs/database.md`).

`lib/data/clients/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as Leads. Lead → Client conversion (`convert_lead_to_client`, `docs/database.md`) is a `security invoker` Postgres function called via `supabase.rpc(...)` from `lib/data/conversion/supabaseConversionRepository.ts` — every insert/update it performs is still checked against these exact same `leads`/`clients`/`timeline_activities` policies, since `security invoker` runs with the calling user's own privileges rather than elevating them. No `service_role` is used anywhere in the Clients migration.

## Supabase RLS for Events (live)

`supabase/migrations/20260718100600_events_rls.sql` enables RLS and defines the policies below on `events`, `checklist_items`, and `event_schedule_items`. Applied to a live, connected Supabase project. Same rules as Leads/Clients above — no bare `using (true)`, every policy scoped `to authenticated`.

| Table | Policy | Rule |
|---|---|---|
| `events` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's Events — **Workspace isolation only**, no `owner`/`admin` role gating. No delete policy — archival is via `status = 'archived'` + `archived_at`, reversible via `restoreEvent`. |
| `checklist_items` | select/insert/update/**delete** | Same `is_workspace_member(workspace_id)` rule. **Unlike every other Supabase-backed table so far, this one gets a delete policy** — `deleteChecklistItem` physically deletes rows. The "can't delete a completed item" rule is enforced by the data layer before the delete call, not by RLS or a second policy. |
| `event_schedule_items` | select/insert/update/**delete** | Same `is_workspace_member(workspace_id)` rule and delete policy as `checklist_items` — `deleteScheduleItem` physically deletes rows, with no completed-item guard (unlike checklist items). |

`notes`/`timeline_activities` needed no new policies for Event-owned rows — their existing `is_workspace_member(workspace_id)` policies already cover any `owner_type`; only the `CHECK` constraint governing which `owner_type`/`type` values are accepted needed widening (`docs/database.md`).

`lib/data/events/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as Leads/Clients — bundles Events, Checklist, Schedule, and Event Notes/Timeline into one repository file since every Checklist/Schedule/Note/Timeline operation needs the owning Event's `workspace_id` first. Default checklist template application (`apply_default_event_checklist`, `docs/database.md`) is a `security invoker` Postgres function, same rationale as `convert_lead_to_client` — every insert it performs is still checked against the caller's own `checklist_items`/`timeline_activities` policies. No `service_role` is used anywhere in the Events migration. Event/Client consistency (a selected Client must exist and belong to the same Workspace) is enforced implicitly by `clients` RLS: fetching a `client_id` from another Workspace returns no row, since that row is invisible to the caller — the same mechanism that already prevents cross-Workspace Lead→Client conversion.

## Supabase Row-Level Security for future business tables (planned)

Once a further business module's own migration phase begins (see `docs/integrations.md`), RLS policies for that module are expected to enforce:

- Every table with `workspace_id` — a row is only visible/writable to authenticated users belonging to that `workspace_id`, using the same `is_workspace_member()`/`has_workspace_role()` helpers documented above rather than duplicating the check.
- `Owner/Admin` vs `Team Member` distinctions enforced via `workspace_members.role`, checked in policy, not in application code alone, where that module's spec calls for it (Leads/Clients above deliberately do not — Workspace isolation only).
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

## Team Knowledge Base and Client Knowledge Base (architecture, planned — not implemented)

Two reserved future modules (Future Phase, after Documents — Team Knowledge Base first, Client Knowledge Base after it; see `docs/database.md`'s `team_kb_articles`/`client_kb_articles` sketches and `docs/workflows.md`) with deliberately different, non-overlapping visibility models. Nothing below is enforced today; no table, RLS policy, or route exists yet.

- **Team Knowledge Base** — visible only to authenticated internal team members with an active Workspace membership, once real role-scoped access exists. Expected to reuse `workspace_members.role`/`is_workspace_member()`/`has_workspace_role()` (above), not a new permission system. Never visible to a client, authenticated or not.
- **Client Knowledge Base** — visible only to clients through the future Client Portal role (see "Client and Team Portal invitations" above), scoped the same way future Client Portal access to Documents is expected to be. Never visible to an internal team member's Client Portal session by mistake, and never available to an anonymous visitor.

Both are independent access surfaces from `documents`/`document_folders` visibility (above) — a Document being `client`-visible says nothing about Client Knowledge Base article visibility, and the two are never expected to share a policy or a table.

## Notification Center (architecture, planned — not implemented, Future Phase after Client Knowledge Base, before Settings)

Reserved for a future module (see `docs/database.md`'s `notifications`/`notification_templates`/`notification_preferences`/`notification_deliveries` sketches and `docs/workflows.md`). Nothing below is enforced today; no table, RLS policy, route, or notification is built yet.

- **A user (or client) only ever sees their own notifications.** `notifications.recipient_user_id`/`recipient_client_id` is expected to be the sole scope for a `select` policy, on top of the usual `workspace_id` check — never a broader query, and never another recipient's notification.
- **Workspace isolation must always be respected**, the same discipline as every other table in this schema — a notification never crosses `workspace_id` regardless of recipient.
- **Only Owner/Admin may broadcast an announcement** (`type = 'announcement'`, sent to many recipients at once) — expected to reuse `has_workspace_role(workspace_id, ['owner','admin'])` (above), not a new permission system. An individual, recipient-scoped notification is never restricted to Owner/Admin the same way — those are generated by the system on the recipient's own behalf.
- **Notification templates and channel enablement are Owner/Admin-only**, the same role gate as broadcast.

## Automation Center (architecture, planned — not implemented, Future Phase after Notification Center)

Reserved for a future module (see `docs/database.md`'s `automation_workflows`/`automation_steps`/`automation_runs`/`automation_run_logs`/`automation_variables`/`automation_templates` sketches and `docs/workflows.md`). Nothing below is enforced today; no table, RLS policy, route, or workflow engine is built yet.

- **Only Owner and Admin may create or edit workflows** — expected to reuse `has_workspace_role(workspace_id, ['owner','admin'])` (above), not a new permission system.
- **Managers may execute a workflow manually, if the workflow explicitly allows it** — a per-workflow flag, not a blanket Manager capability; the default is Owner/Admin-only for every action (create, edit, and execute).
- **Team members only consume results** (Timeline entries, notifications, generated records the workflow produced) — never workflow definitions, run history, or execution controls.
- **Workspace isolation must always be respected**, the same discipline as every other table in this schema.
- The Automation Center must never duplicate Notification Center logic (above) — it may trigger a notification, but the Notification Center alone remains responsible for deciding channels/templates/delivery and for recipient-scoped visibility of the result.

## Explicitly out of scope for now

- Granular per-field permissions
- Custom/configurable roles
- Any client-facing access (until Client Portal, Phase 3)
- Enforcing `documents`/`document_folders` `visibility` at the data-layer or RLS level (metadata only until real auth exists)
- Real file upload, signed URLs, or migrating any Documents metadata to Supabase — the `documents`/`avatars` Storage buckets and their access policies exist (see "Storage Foundation" above) but nothing uploads to them yet
- Client Portal and Team Portal implementation, invitation UI, actual invitation sending, an `invitations` table, or a `service_role` admin client — the architecture is documented above ("Client and Team Portal invitations") but nothing is built
- Team Knowledge Base and Client Knowledge Base: any table, migration, RLS policy, route, UI, or CMS — the architecture is documented above ("Team Knowledge Base and Client Knowledge Base") but nothing is built; reserved for a Future Phase after Documents
- Notification Center: any table, migration, RLS policy, route, UI, component, notification, or delivery channel integration — the architecture is documented above ("Notification Center") but nothing is built; reserved for a Future Phase after Client Knowledge Base, before Settings
- Automation Center: any table, migration, RLS policy, route, UI, component, workflow engine, or third-party integration (Slack, Discord, Google Calendar, Google Drive, Stripe, webhooks) — the architecture is documented above ("Automation Center") but nothing is built; reserved for a Future Phase after Notification Center
