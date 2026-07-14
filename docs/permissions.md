# Permissions

Access control model for BloomOS. Written ahead of Supabase connection — RLS policies below are the intended design, not yet applied to a live database.

## MVP roles

The MVP runs for a single Workspace (Amoré Bloom — see `BLOOMOS_BIBLE.md` §7) with a small team, so the role model is intentionally minimal:

| Role | Description |
|---|---|
| **Owner/Admin** | Full access to all MVP modules: Dashboard, Leads, Clients, Events, Contracts, Finance. Can manage team access. |
| **Team Member** | Operational access to Leads, Clients, Events, Contracts, Finance for day-to-day work. No account/billing administration. |

No client-facing role exists in the MVP — the future **Client Portal** module (Phase 3) introduces an external, scoped-down role for clients to view their own event only.

## Guiding rules

- **Workspace-scoped by default.** Every query is implicitly scoped to `workspace_id` (see `docs/database.md`), even with a single tenant today — this is what makes multi-tenancy a flip of a switch later, not a rebuild.
- **No cross-tenant visibility, ever** — even before multi-tenancy is "on," the data model and access rules behave as if other tenants already exist.
- **Least privilege.** A role gets exactly the modules its job requires. The future Client Portal role, for example, sees only its own event's data — never other clients, never internal notes.

## Supabase Row-Level Security (planned)

Once Supabase is connected (see `docs/integrations.md`), RLS policies enforce:

- Every table with `workspace_id` — a row is only visible/writable to authenticated users belonging to that `workspace_id`.
- `Owner/Admin` vs `Team Member` distinctions enforced via a role claim on the authenticated user, checked in policy, not in application code alone.
- The future Client Portal role restricted, at the policy level, to its own `client_id`'s and linked `event_id`'s rows only — never a broader query.

## Explicitly out of scope for now

- Granular per-field permissions
- Custom/configurable roles
- Any client-facing access (until Client Portal, Phase 3)
