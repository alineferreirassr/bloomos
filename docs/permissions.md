# Permissions

Access control model for BloomOS. Written ahead of Supabase connection — RLS policies below are the intended design, not yet applied to a live database.

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

## Supabase Row-Level Security (planned)

Once Supabase is connected (see `docs/integrations.md`), RLS policies enforce:

- Every table with `workspace_id` — a row is only visible/writable to authenticated users belonging to that `workspace_id`.
- `Owner/Admin` vs `Team Member` distinctions enforced via a role claim on the authenticated user, checked in policy, not in application code alone.
- The future Client Portal role restricted, at the policy level, to its own `client_id`'s and linked `event_id`'s rows only — never a broader query.

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
- Real file storage, signed URLs, or any Supabase Storage connection
