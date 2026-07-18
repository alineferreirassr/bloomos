# Permissions

Access control model for BloomOS. Most of this document is written ahead of a live Supabase connection — RLS policies below are the intended design, not yet applied to a real database. The exception is the **Supabase Foundation** (`profiles`/`workspaces`/`workspace_members`, `feature/supabase-foundation`): RLS for those three tables is written, reviewed, and ready in `supabase/migrations/` — see "Supabase Foundation RLS (ready, not yet live)" below — but still not applied to any real database, since no Supabase project is connected. Leads/Clients/Events/Contracts/Finance/Documents, the Team foundation (`roles`/`permissions`/`role_permissions`/`workspace_invitations`, plus the upgraded `workspace_members` policies), Client Accounts + Invitations, and Client Portal MVP's additive client-facing policies now have live RLS (see their own sections below).

## Auth foundation (email/password only)

`lib/auth/` provides sign in, sign up, sign out, session retrieval, current-user retrieval, password reset request, and password update — all normalized through `lib/supabase/errors.ts` so a raw Supabase/Postgres error never reaches the UI. This is infrastructure, not a finished product surface:

- **Email/password only.** No social providers are enabled.
- **No public signup for arbitrary visitors.** `signUpWithPassword` exists, but it's reachable only from the invitation acceptance flow below (`/invitations/[token]`) — there is still no general "create an account" page. The very first owner/admin account and its Workspace row are created manually via the Supabase Dashboard/SQL once real credentials exist (see `docs/integrations.md`); every account after that is provisioned through an invitation.
- **Internal team invitations are live.** A Workspace owner/admin/manager (per role authority, see "Team membership and invitations" below) can invite a new team member by email; the recipient signs up or signs in, confirms the invited email, and becomes an active `workspace_members` row — see "Team membership and invitations (live)" below for the full flow, security design, and role/permission matrix. **Client Portal account invitations are also live** — see "Client accounts and invitations (live)" below. **The full Client Portal (real Events/Contracts/Invoices/Documents views for a client) is also live** — see "Client Portal MVP (live)" below. **Team Portal persona invitations remain unimplemented** — see "Team Portal invitations" further below, which now describes only that separate, still-future scope.
- **Minimal pages, not final UI.** `/sign-in`, `/reset-password`, `/update-password`, `/invitations/[token]` exist so the Auth foundation and Team foundation are exercisable end-to-end, but are not the polished Auth experience the product will ship.
- **`getCurrentUser()` over `getSession()`** for anything auth-gating — it revalidates the token against Supabase Auth rather than trusting the session cookie alone (`lib/auth/session.ts`). The one exception is the invitation acceptance page itself, which checks auth state directly via `supabase.auth.getUser()` client-side, since it must render correctly for a visitor with no Workspace membership yet — `getCurrentUser()`'s usual callers all assume an existing membership.
- **Route protection is opt-in this phase.** `src/middleware.ts` only redirects unauthenticated visitors away from protected routes (`/dashboard`, `/account`, `/leads`, `/clients`, `/events`, `/contracts`, `/finance`, `/documents`, `/team`) when `NEXT_PUBLIC_DATA_MODE=supabase`. In `mock` mode (the default), every route is open and local development never requires a login — see `docs/integrations.md`. `/invitations/[token]` is never protected in either mode — it must be reachable pre-authentication. This middleware check only confirms a session exists — it says nothing about *which* permission a route needs; see "Team Portal MVP" below for the page-level permission gate that sits on top of it.

## Workspace membership model

`workspace_members` carries a `role` and a `status` per (`workspace_id`, `user_id`) pair (unique constraint):

| Role | Intent |
|---|---|
| `owner` | Full Workspace control, including roles, invitations, and billing-related settings. Cannot be removed or demoted by anyone else, and the last active owner can never be removed — see "Last-owner protection" below. |
| `admin` | Broad operational access across every business module; may invite and manage `manager`/`staff` roles. Cannot promote anyone to `owner`, and cannot remove or demote the owner. |
| `manager` | Operational access to leads, clients, events, contracts, finance, and documents. Cannot manage `owner`/`admin` roles or change Workspace-level security settings. |
| `staff` | Limited, explicit, view-only operational access by default. No team-management access. |

`owner`/`admin`/`manager`/`staff` replaces the Supabase Foundation phase's placeholder set (`owner`/`admin`/`manager`/`team`/`viewer`) — `team` and `viewer` were never referenced by any RLS policy, application code, or live data, so the Team foundation migration cleanly replaced rather than additively widened the role enum (the one deliberate exception to this schema's usual widen-only discipline; see `docs/database.md`).

| Status | Effect |
|---|---|
| `active` | Normal access, gated by role/permission. |
| `invited` | Reserved, currently unused — every RLS membership check (`is_workspace_member()`, `has_workspace_role()`, `has_permission()`) requires `status = 'active'`, so an `invited` row would grant no access. The live invitation flow (below) does not create an `invited` membership row at all: a `workspace_members` row is created directly with `status: 'active'` at the moment an invitation is accepted. |
| `suspended` | Explicitly locked out — same mechanism as `invited`: fails every membership check without needing a separate "disabled" concept. |

The MVP *UI* assumes one active Workspace per session (`CURRENT_WORKSPACE_ID`, `core/constants/workspace.ts`), but the schema already supports a user belonging to several Workspaces — `current_user_workspace_ids()` returns all of them.

**Do not rely on role names alone anywhere new.** Every access decision in the Team foundation and beyond is expected to check a granular permission (`has_permission(workspace_id, permission)`, below) rather than a role string, so a future fifth role can be added by inserting a `roles` row and a `role_permissions` set, without rewriting RLS policies or application `if` statements. `has_workspace_role()` remains in use only where role *identity itself* — not a granted capability — is what matters, e.g. owner-only branding (`getWorkspaceDisplayName()`, `docs/workflows.md`).

## Granular permissions (Team foundation — live)

`roles`, `permissions`, and `role_permissions` (`docs/database.md`'s "Team foundation" section) are live, global (non-Workspace-scoped) catalog tables: every Workspace shares the same 4 roles, same 30 permissions, and same default role→permission grants. `has_permission(p_workspace_id, p_permission)` (a `security definer`, `stable` SQL function, same shape as `has_workspace_role()`) is the canonical check — true iff the caller has an `active` membership in the Workspace whose role is granted that permission in `role_permissions`. `lib/team/permissionMatrix.ts`'s `DEFAULT_ROLE_PERMISSIONS` is the mock-mode mirror of the same table (mock mode has no `role_permissions` table to query) and must be kept in sync with the seed migration by comment.

The full default matrix (`supabase/migrations/20260724101000_team_seed_data.sql`):

| Permission | Owner | Admin | Manager | Staff |
|---|---|---|---|---|
| `workspace.view` | ✓ | ✓ | ✓ | ✓ |
| `workspace.manage` | ✓ | ✓ | | |
| `team.view` | ✓ | ✓ | ✓ | ✓ |
| `team.invite` | ✓ | ✓ | | |
| `team.manage_roles` | ✓ | ✓ | | |
| `team.deactivate` | ✓ | ✓ | | |
| `leads.view` | ✓ | ✓ | ✓ | ✓ |
| `leads.create` | ✓ | ✓ | ✓ | |
| `leads.update` | ✓ | ✓ | ✓ | |
| `leads.archive` | ✓ | ✓ | ✓ | |
| `clients.view` | ✓ | ✓ | ✓ | ✓ |
| `clients.create` | ✓ | ✓ | ✓ | |
| `clients.update` | ✓ | ✓ | ✓ | |
| `clients.archive` | ✓ | ✓ | ✓ | |
| `events.view` | ✓ | ✓ | ✓ | ✓ |
| `events.create` | ✓ | ✓ | ✓ | |
| `events.update` | ✓ | ✓ | ✓ | |
| `events.archive` | ✓ | ✓ | ✓ | |
| `contracts.view` | ✓ | ✓ | ✓ | ✓ |
| `contracts.create` | ✓ | ✓ | ✓ | |
| `contracts.update` | ✓ | ✓ | ✓ | |
| `contracts.lifecycle` | ✓ | ✓ | ✓ | |
| `finance.view` | ✓ | ✓ | ✓ | ✓ |
| `finance.create` | ✓ | ✓ | ✓ | |
| `finance.update` | ✓ | ✓ | ✓ | |
| `finance.refund` | ✓ | ✓ | | |
| `documents.view` | ✓ | ✓ | ✓ | ✓ |
| `documents.create` | ✓ | ✓ | ✓ | |
| `documents.update` | ✓ | ✓ | ✓ | |
| `documents.archive` | ✓ | ✓ | ✓ | |

Owner and admin are granted the identical permission set on purpose — the meaningful difference between them (cannot promote to owner, cannot remove/demote the last owner) is enforced by trigger (`trg_protect_workspace_owners`/`trg_validate_invitation_role_authority`, below), not by withholding a permission with no owner-specific equivalent in this catalog. Manager gets real create/update/archive access across every business module except the two most sensitive reversal-type actions (`finance.refund`, and all `team.*` beyond viewing). Staff gets view-only across the board — "permissions must be explicit," so nothing beyond `*.view` is granted by default.

**Member-specific permission overrides are explicitly out of scope for this phase** — not necessary for MVP; if a future need arises for one member to have a permission their role doesn't otherwise grant, that's documented here as future scope rather than built now (a per-member override table would need its own precedence rules against `role_permissions`, not worth the complexity without a concrete use case).

This granular catalog governed the **team-management surface only** at the database/RLS level in the Team foundation phase — business-module RLS itself (Leads/Clients/Events/Contracts/Finance/Documents) remains Workspace-isolation-only (see each module's own RLS section below). The Team Portal MVP phase (below) is the catalog's second consumer: every `*.create`/`*.update`/`*.archive`/`*.lifecycle`/`finance.refund` permission now also gates the corresponding UI action and route, via `useMemberSession().can()` — but this is UI-level gating, not a new RLS policy. Wiring these same permissions into business-module RLS policies remains anticipated future work, not part of either phase's scope so far.

## Team membership and invitations (Team foundation — live)

Internal team members authenticate through Supabase Auth like any other user — there is no separate auth system and no permanent password ever generated by BloomOS for an invited teammate. See `docs/workflows.md`'s "Team membership and invitations" section for the full invitation status machine (`pending`/`accepted`/`expired`/`revoked`) and the step-by-step acceptance flow. This section covers the security design specifically.

### Required flow (as built)

1. An authorized Workspace member (role authority below) creates an invitation specifying: recipient email and invited role. `createWorkspaceInvitation` fails if a `pending` invitation already exists for that Workspace/email pair, or if the caller lacks authority to grant the requested role.
2. A raw invitation token (32 random bytes, base64url) is generated client/server-side (`lib/team/invitationToken.ts`) and returned to the caller exactly once. Only its SHA-256 hash (`token_hash`) is written to `workspace_invitations` — **the raw token is never persisted anywhere.**
3. The invitation link (`/invitations/{token}`) is constructed from that raw token. In this phase, no production email provider is integrated — the link is surfaced via a dev-safe "copy link" affordance in the Invitations UI (see "UI scope" below), not emailed.
4. The recipient opens the link. `get_invitation_by_token` (an RPC granted to `anon` as well as `authenticated`, since the visitor has no session yet) re-hashes the supplied token and returns only the minimum safe fields to render the page: Workspace name, invited email, invited role, status, expiry.
5. If the recipient has no account, they sign up (`signUpWithPassword`); if they do, they sign in (`signInWithPassword`) — both are the same Server Actions every other Auth flow uses, not a parallel invitation-specific auth path.
6. The recipient must confirm the **same email the invitation was sent to** — `accept_workspace_invitation` compares the authenticated caller's `auth.uid()` email against the invitation's `email` and rejects a mismatch, even for a visitor signed in as some other legitimate Workspace member.
7. Acceptance is atomic and server-side (`accept_workspace_invitation`, row-locked `for update` to prevent a double-accept race): the invitation flips to `accepted`, and a `workspace_members` row is created directly with `status: 'active'` in the same transaction. There is no intermediate `invited` membership row.
8. The recipient is redirected to a safe post-acceptance page (the dashboard) — never to an arbitrary `redirectTo`, avoiding the open-redirect class of bug `safeRedirectTarget` already guards against elsewhere.

### Never

- Generate or email a temporary password.
- Store a raw invitation token anywhere — only `token_hash` (SHA-256 hex) is ever written, in both Supabase and mock mode.
- Expose the Supabase `service_role` key in browser code, or use it for ordinary invitation acceptance — the entire flow above runs through RLS-gated inserts (creation/resend) and two narrowly-scoped `security definer` RPCs (lookup/acceptance), never `service_role`.
- Integrate a production email provider (Resend, SendGrid, Mailgun, Postmark, or otherwise) without a separate, explicit approval — see "Email sending" below.

### Role authority (who can invite/promote whom)

Enforced by `trg_validate_invitation_role_authority` (a `before insert` trigger on `workspace_invitations`, not just RLS or UI-layer logic):

- Only an `owner` may invite/promote to `owner` or `admin`.
- An `admin` may invite/promote only to `manager` or `staff`.
- A `manager`/`staff` cannot invite anyone or manage roles at all — gated upstream by the `team.invite`/`team.manage_roles` permissions before the trigger is even reached.

### Last-owner protection

Enforced by `trg_protect_workspace_owners` (a `before update or delete` trigger on `workspace_members`): a Workspace's sole remaining `owner` can never be removed, demoted to a non-owner role, or suspended — the action fails outright at the database level regardless of which repository, RPC, or future admin tool attempts it, not just a check the UI happens to perform.

### Required supporting operations (as built)

- **Resend** (`resendWorkspaceInvitation`) — generates a fresh token/hash and a fresh `expires_at` for an existing `pending` invitation, superseding the old token in place (the old link stops working immediately) rather than creating a second row.
- **Revoke** (`revokeWorkspaceInvitation`) — moves a `pending` invitation to `revoked`, permanently invalidating its link.
- **Expiration** (`expireWorkspaceInvitations`) — a `pending` invitation past its `expires_at` is treated as expired by `getInvitationStatus`/`getInvitationNextAction` (`core/workflows/invitationWorkflow.ts`); its next recommended action is to resend rather than silently leaving it `pending` forever.
- **Password recovery for existing users** — unrelated to invitation acceptance; reuses the existing `requestPasswordReset()`/`updatePassword()` flow (`lib/auth/actions.ts`).

### Email sending (dev-safe copy-link only, this phase)

No production email provider is wired up — building one wasn't required, so none was added. `createWorkspaceInvitation`/`resendWorkspaceInvitation` generate the invitation URL and return it to the caller; the Invitations UI offers a "copy link" action so a real invitation can be tested end-to-end without sending real email. The repository's shape (`createWorkspaceInvitation` returning the link, independent of any delivery mechanism) leaves room for a future provider interface, but **no Resend/SendGrid/Mailgun/Postmark integration exists or was added**, matching the explicit instruction not to add one without separate approval.

### Server-only administrative operations

Unlike the Client/Team Portal sketch below (which anticipated needing the Supabase Auth Admin API and `service_role`), **the live internal-invitation flow above needs no `service_role` client anywhere.** `createWorkspaceInvitation`/`resendWorkspaceInvitation`/`revokeWorkspaceInvitation` are plain RLS-gated inserts/updates (the caller already has a Workspace membership and the relevant `team.invite` permission by the time they call these); `getInvitationByToken`/`acceptWorkspaceInvitation` are the two narrowly-scoped `security definer` RPCs described above, chosen specifically because an ordinary RLS-gated statement can't authorize a caller who has no Workspace membership yet — the token itself (256 bits of entropy, single-use, hashed at rest) is the security boundary for those two operations, not an elevated credential. Both RPCs pin `set search_path = public` and validate everything they touch (token match, expiry, status, email match, workspace_id) before writing anything.

### UI scope (minimum only, this phase)

- **Team Members page** (`/team`) — list of Workspace members: name, email, role, status, joined date, and permission-gated actions (change role, deactivate/reactivate, remove) — visible to anyone with `team.view`, actions gated by `team.manage_roles`/`team.deactivate`.
- **Invitations** (same page) — list by status, create (email + role select, role options limited to what the caller's own role may grant), dev copy-link, resend, revoke.
- **Invitation acceptance page** (`/invitations/[token]`) — validates the token, shows Workspace name/invited email/role, sign-in/sign-up CTA, accept action, and clear error states for expired/revoked/already-accepted/email-mismatch.

**Explicitly not built this phase**: a full Team Portal navigation shell or dashboard, Client Accounts, a Client Portal, a Team Knowledge Base, a Client Knowledge Base, a Notification Center, or an Automation Center — see "Client and Team Portal invitations" and the Knowledge Base/Notification/Automation sections below, all still architecture-only.

## Team Portal MVP (live)

The authenticated internal app shell — Team foundation's navigation/dashboard/action-gating consumer, described fully in `docs/workflows.md`'s "Team Portal MVP (live)" section. This section covers only the access-control model specifically; see `docs/workflows.md` for the member-session/route-guard/UI architecture.

**Route-level access is centrally mapped, not scattered.** `core/permissions/routeAccess.ts`'s `ROUTE_ACCESS_MAP` assigns each route prefix either `{ kind: "active-membership" }` (just needs a live Workspace membership — `/dashboard`, `/account`) or `{ kind: "permission"; permission }` (a specific granular permission from the catalog above — `/leads` → `leads.view`, `/clients` → `clients.view`, `/events` → `events.view`, `/contracts` → `contracts.view`, `/finance` → `finance.view`, `/documents` → `documents.view`, `/team` → `team.view`). `core/guards/memberAccess.ts`'s `resolveMemberAccessDecision()` is the pure function that checks the member's coarse access state (unauthenticated / no-workspace / inactive / active-with-permissions) against that requirement — access state is always checked before the specific permission, so an inactive member is reported `inactive`, never `forbidden`, even for a permission their role would otherwise grant.

**This is UI/route-level gating, layered on top of the existing membership/permission model — it introduces no new permission, role, or database check.** Every route guard and every gated UI action (see `docs/workflows.md`'s "Action-level gating") ultimately calls the same `has_permission()`-backed session data already described above; nothing here bypasses or duplicates RLS. As stated in the Team Portal MVP spec itself: **UI gating is not a security boundary by itself** — business-module RLS (Leads/Clients/Events/Contracts/Finance/Documents) remains Workspace-isolation-only, unaffected by this phase, so any Workspace member's authenticated session can still technically reach the underlying data server-side regardless of role. True per-permission data minimization for these modules remains future work (see "Explicitly out of scope" below).

**No self-bootstrap for invited members.** A member with no `workspace_members` row at all (`no-workspace`) sees a safe blocked-access page, never an automatically created Workspace — only the original owner-bootstrap path (Auth foundation) creates a Workspace. An `inactive`/`suspended` member can still sign in but is blocked from every business route by the same guard, with a clear account-inactive message and a working sign-out — never a silent redirect loop, never a leak of Workspace business data before the blocked state renders.

## Client accounts and invitations (Client Accounts + Invitations foundation — live)

**Live in Supabase mode** (`lib/data/clientAccess/`, `docs/database.md`'s "Client Accounts + Invitations foundation" section) — the authentication, account-linking, and invitation foundation for **external** Amoré Bloom clients, the second Phase 2 module. Confirms the "preferred starting point" the architecture section below originally predicted: this shipped entirely on the same token-hash pattern proven by the live internal-invitation flow above, and needed **no** Supabase Auth Admin API and **no** `service_role` client.

**The core rule still holds exactly as designed: BloomOS never generates, emails, or displays a temporary password.** Every client account is provisioned through a single-use invitation link (`client_invitations`); the recipient — never BloomOS — is the only party who ever sets their own password, via the ordinary `signUpWithPassword` Server Action every other Auth flow uses.

**Canonical model**: Auth User → `client_accounts` row → exactly one `clients` record → permitted Events/Contracts/Invoices/Documents (live — see "Client Portal MVP (live)" below). A client account is **never** a `workspace_members` row, never carries an internal role, and never receives a `role_permissions` grant — internal team members and Client Portal users are distinguished purely by which linking table has a row for a given `auth.uid()`, never by an email-domain heuristic.

**Account statuses** (`core/enums/clientAccountStatus.ts`): `invited` (reserved/unused, same precedent as `workspace_members.status`), `active`, `suspended`, `revoked`. Unlike Team membership, `revoked` is explicitly reversible — a team member can `reactivateClientAccount`, or the same person accepting a fresh invitation reactivates their existing row in place (never a duplicate, enforced by a structural `unique(workspace_id, client_id, auth_user_id)` constraint).

**Required flow (as built)**:
1. An authorized internal team member (`clients.portal_invite`) creates an invitation specifying: recipient email and the `clients` record to link.
2. A raw invitation token (256 bits, base64url) is generated and returned to the caller exactly once — only its SHA-256 hash (`token_hash`) is ever persisted, the identical convention to the live internal-invitation flow, reusing `lib/team/invitationToken.ts` unchanged.
3. The invitation link (`/client-invitations/{token}`) is surfaced via the same dev-safe "copy link" affordance as Team invitations — no production email provider integrated this phase either.
4. The recipient opens the link; `get_client_invitation_by_token` (an RPC granted to `anon` as well as `authenticated`) returns only display-safe fields: Workspace name, the Client's own first/last name, invited email, status, expiry — never any internal-only `clients` field (allergies, VIP status, emergency contacts, etc.).
5. The recipient signs up or signs in — the same Server Actions every other Auth flow uses.
6. The recipient must confirm the same email the invitation was sent to — `accept_client_invitation` compares `auth.uid()`'s profile email against the invitation's email and rejects a mismatch.
7. Acceptance is atomic and server-side, row-locked to prevent a double-accept race: the invitation flips to `accepted`, and a `client_accounts` row is created (or, if one already exists for that exact person/Client pair, reactivated in place) with `status: 'active'` — **never** a `workspace_members` row.
8. The recipient is redirected to `/client-access` — the Client Portal's own minimal landing page, never `/dashboard` or anywhere inside the internal Team Portal shell.

**Never**: generate or email a temporary password; store a raw invitation token anywhere (only `token_hash`); expose `service_role` in browser code or use it for ordinary invitation acceptance (this entire flow runs through RLS-gated inserts and two narrowly-scoped `security definer` RPCs, exactly like the internal flow); integrate a production email provider without separate explicit approval.

**Required supporting operations (as built)**: Resend (`resendClientInvitation`, supersedes the old token in place) and Revoke (`revokeClientInvitation`, moves a `pending` invitation to `revoked`) mirror the Team flow's exact shape. Expiration (`expireClientInvitations`) treats a past-due `pending` invitation as expired via the same reused `getInvitationNextRecommendedAction`. Password recovery is unrelated to invitation acceptance and reuses the existing `requestPasswordReset()`/`updatePassword()` flow.

**Auth separation** — a user may hold a `workspace_members` row, a `client_accounts` row, both, or neither. A client-only user hitting any `(app)` route (the internal Team Portal) sees `AccessBlockedPage`'s "No Workspace access" — safe, a dead end by design, never a crash. An internal team member with no `client_accounts` row hitting `/client-access` sees the Client Portal's own "No Client Portal access" blocked state. Neither ever triggers the original owner-Workspace-bootstrap path.

**Granular permissions extended, not duplicated**: `clients.portal_view` (owner/admin/manager/staff, the same "broad view" precedent as `team.view`), `clients.portal_invite`/`clients.portal_manage`/`clients.portal_suspend` (owner/admin only by default, the same precedent as `team.invite`/`team.manage_roles`/`team.deactivate`) — four new rows in the existing global `permissions`/`role_permissions` catalog, never a parallel permission system.

**UI scope (minimum only, this phase)**:
- **Client Access section** (embedded on Client Detail, gated on `clients.portal_view`) — linked accounts with status/last-access, invite/resend/revoke on invitations, suspend/reactivate/revoke on accounts, each gated by its own specific permission. Never exposes a `token_hash`.
- **Client invitation acceptance page** (`/client-invitations/[token]`) — mirrors the internal one exactly: token validation, Client name/invited email/status, sign-in/sign-up CTA, accept action, clear error states.
- **Client Portal Overview page** (`/client-access`) — now the real Overview described in "Client Portal MVP (live)" below, not a placeholder: welcome message, Client name, account status, upcoming event/contract-in-progress/next-payment-due/recent-documents cards driven by real client-safe data, Sign Out.

**Explicitly not built this phase**: Team Portal persona invitations (below, still architecture-only), a production email provider, and full `documents`/`document_folders` `visibility`-aware filtering for internal (non-client) readers (still Workspace-isolation-only for a team member — see "Documents visibility" below; only the client-facing read path now enforces `visibility`, see "Client Portal MVP (live)" below).

## Team Portal invitations (architecture, planned — not implemented)

**Distinct from, and narrower than, both live invitation flows above.** This section is a permanent BloomOS principle, documented ahead of Team Portal implementation — the future work of letting a non-full-member internal user (e.g. day-of staff or contractors) self-activate a scoped-down, internal-lite account that isn't a full `owner`/`admin`/`manager`/`staff` `workspace_members` row. No invitation UI, invitation-sending code, or activation page for *this* scope exists yet; nothing below changes current application behavior. Neither the live `workspace_invitations` flow nor the live `client_invitations` flow above is reused as-is for this scope — a Team Portal persona is a third, distinct audience, though this future work is expected to reuse the identical token-hash security pattern both live flows already proved out (see `docs/database.md`'s `team_portal_invitations` sketch).

**The core rule remains: BloomOS never generates, emails, or displays a temporary password, for any portal, ever.** Every Team Portal persona account would be provisioned through a single-use invitation link, exactly like both live flows above.

### Required flow

1. An authorized Workspace owner/admin creates an invitation specifying: recipient email, recipient name, Workspace, scoped-down role, and permissions.
2. A single-use invitation link is sent to the recipient, reusing the proven token-hash pattern (no Supabase Auth Admin API needed, per both live flows' precedent).
3. The recipient follows the link to a branded Amoré Bloom activation page.
4. The recipient sets their own password on that activation page.
5. On successful activation: the invitation is marked accepted, the corresponding Team Portal persona membership is activated, and the recipient is redirected to the correct scoped-down area — never the full internal Team Portal shell, and never `/client-access`.

### Never

- Generate a temporary password.
- Send a password by email, SMS, or any other channel.
- Display a password to an administrator, in any UI, log, or export.
- Store a plaintext password anywhere.
- Log a password, anywhere, at any log level.

### Required supporting operations

- **Resend / Revoke / Expiration** — same shape as both live invitation flows above.
- **Existing-user handling** — if the invited email already has a Supabase Auth account (e.g. also an internal team member, or also a Client Portal user), the flow must detect this and add the new membership to the existing account rather than erroring or creating a duplicate `auth.users` row.
- **Password recovery for existing users** — unrelated to invitation acceptance; reuses the existing `requestPasswordReset()`/`updatePassword()` flow.
- **Audit Timeline entries** — every invitation lifecycle transition is expected to record a Timeline entry via `recordTimelineActivity`, never constructed by hand.

Never conflated with the other two: a Team Portal persona invitation grants neither full internal Workspace membership nor Client Portal access, even for the same email address that might separately hold one or both of those.

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

## Supabase RLS for the Media Library (live)

`supabase/migrations/20260719100400_media_assets_rls.sql` enables RLS and defines the policies below on `media_assets`. Applied to a live, connected Supabase project. Same rules as Leads/Clients/Events above — no bare `using (true)`, every policy scoped `to authenticated`, Workspace isolation only (no `owner`/`admin` role gating).

| Table | Policy | Rule |
|---|---|---|
| `media_assets` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's media assets. No delete policy — soft delete only, via `archived_at`, reversible via `restoreMediaAsset`. |

`lib/data/media/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as Leads/Clients/Events. No `service_role` is used anywhere. This table is deliberately independent of Documents/Contracts/Finance/Knowledge Base/Notifications/Automation — it knows nothing about any of them; those modules become consumers of `media_assets` (via `owner_type`/`owner_id`) in their own future migrations, not the other way around. See `docs/database.md`'s `media_assets` section for the full schema and future-extension notes.

## Supabase RLS for Contracts (live)

`supabase/migrations/20260720100600_contracts_rls.sql` enables RLS and defines the policies below on `contracts`, `contract_templates`, and `contract_exhibits`. Applied to a live, connected Supabase project. Same rules as Leads/Clients/Events/Media Library above — no bare `using (true)`, every policy scoped `to authenticated`, Workspace isolation only (no `owner`/`admin` role gating).

| Table | Policy | Rule |
|---|---|---|
| `contracts` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's Contracts — **Workspace isolation only**. No delete policy — archival is via `status = 'archived'` + `archived_at`, reversible via `restoreContract`. |
| `contract_templates` | select only | Same `is_workspace_member(workspace_id)` rule, but **no insert/update/delete policy** — the current public API has no create/update path ("no editor yet"); granting write policies with no app code that ever uses them is needless attack surface, widened when a template editor ships. |
| `contract_exhibits` | select/insert/update/**delete** | Same `is_workspace_member(workspace_id)` rule. **Gets a delete policy**, since `deleteContractExhibit` physically deletes rows — same precedent as `checklist_items`/`event_schedule_items`. No lock-state guard at the RLS or data-layer level; enforcement of "no exhibit edits once locked" stays a UI-layer concern, matching the existing division of responsibility documented in `lib/data/index.ts`. |

`notes`/`timeline_activities` needed no new policies for Contract-owned rows — their existing `is_workspace_member(workspace_id)` policies already cover any `owner_type`; only the `CHECK` constraint governing which `owner_type`/`type` values are accepted needed widening (`docs/database.md`).

`lib/data/contracts/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as Leads/Clients/Events/Media Library — bundles Contracts, Contract Templates, Contract Exhibits, and Contract Notes/Timeline into one repository file since every Exhibit/Note/Timeline operation needs the owning Contract's `workspace_id` first. Contract numbering (`generate_contract_number`, `docs/database.md`) is a `security invoker` Postgres function, same rationale as `convert_lead_to_client`/`apply_default_event_checklist` — its SELECT is still checked against the caller's own `contracts` RLS policy. No `service_role` is used anywhere in the Contracts migration. Client/Event consistency (a selected Client must exist and belong to the same Workspace; an optional Event must belong to that same Client) is enforced implicitly by `clients`/`events` RLS: fetching a `client_id`/`event_id` from another Workspace returns no row, since that row is invisible to the caller — the same mechanism already relied on for Lead→Client conversion and Event/Client consistency.

## Supabase RLS for Finance (live)

`supabase/migrations/20260721100600_finance_rls.sql` enables RLS and defines the policies below on `invoices`, `payments`, and `expenses`. Applied to a live, connected Supabase project. Same rules as Leads/Clients/Events/Media Library/Contracts above — no bare `using (true)`, every policy scoped `to authenticated`, Workspace isolation only (no `owner`/`admin` role gating).

| Table | Policy | Rule |
|---|---|---|
| `invoices` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's Invoices. No delete policy — archival is via `status = 'archived'` + `archived_at`, reversible via `restoreInvoice`. |
| `payments` | select/insert/update | Same `is_workspace_member(workspace_id)` rule. No delete policy — a Payment's history is permanent for an accurate audit trail; `cancelled`/`failed`/`refunded` are terminal statuses, never deletions. |
| `expenses` | select/insert/update | Same `is_workspace_member(workspace_id)` rule. No delete policy — archival is via `status = 'archived'` + `archived_at`, reversible via `restoreExpense`. |

`notes`/`timeline_activities` needed no new policies for Invoice/Payment/Expense-owned rows — their existing `is_workspace_member(workspace_id)` policies already cover any `owner_type`; only the `CHECK` constraint governing which `owner_type`/`type` values are accepted needed widening (`docs/database.md`).

`lib/data/finance/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as every prior module — bundles Invoices, Payments, Expenses, and their Notes/Timeline into one repository file since a successful Payment mutation must atomically recompute its linked Invoice. Invoice numbering (`generate_invoice_number`) and payment-application atomicity (`recompute_invoice_balance`) and the refund RPC (`process_payment_refund`) are all `security invoker` Postgres functions (`docs/database.md`) — every statement inside still runs under the caller's own RLS. No `service_role` is used anywhere in the Finance migration. Client/Event/Contract consistency is enforced implicitly by `clients`/`events`/`contracts` RLS, the same mechanism relied on since Lead→Client conversion.

## Supabase RLS for Documents (live)

`supabase/migrations/20260722100600_documents_rls.sql` enables RLS and defines the policies below on `documents` and `document_folders`. Applied to a live, connected Supabase project. Same rules as every prior module above — no bare `using (true)`, every policy scoped `to authenticated`, Workspace isolation only (no `owner`/`admin` role gating).

| Table | Policy | Rule |
|---|---|---|
| `documents` | select/insert/update | Any user with an **active** membership (`is_workspace_member(workspace_id)`) may read and write that Workspace's Documents. No delete policy — soft delete only, via `status = 'deleted'` + `deleted_at`, reversible via `restoreDocument`. |
| `document_folders` | select/insert/update | Same `is_workspace_member(workspace_id)` rule. No delete policy — archival only, via `archived_at`, reversible via `restoreDocumentFolder`. |

`notes`/`timeline_activities` needed no new policies for Document/DocumentFolder-owned rows — their existing `is_workspace_member(workspace_id)` policies already cover any `owner_type`; only the `CHECK` constraint governing which `owner_type`/`type` values are accepted needed widening (`docs/database.md`). MediaAsset access — the linked physical file behind a Document version — remains governed entirely by the existing `media_assets` table RLS and `media-assets` Storage bucket policies (above); this migration does not touch either.

`lib/data/documents/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as every prior module — bundles Documents, Document Folders, and Document/Folder Notes/Timeline into one repository file since Folders need the owning Document's `workspace_id` and Notes/Timeline need both owner types. Atomic version creation (`create_document_version`) and default folder-template application (`apply_default_folder_template`) are both `security invoker` Postgres functions (`docs/database.md`) — every statement inside still runs under the caller's own RLS. No `service_role` is used anywhere in the Documents migration. A Document never independently validates or stores file bytes, checksums, or MIME types — it links to a `media_assets` row (`media_asset_id`) whose own RLS and Storage policies already govern real file access; see "Documents visibility" below for the resulting security model.

## Supabase RLS for the Team foundation (live)

`supabase/migrations/20260724100900_team_rls.sql` enables RLS and defines the policies below on `roles`, `permissions`, `role_permissions`, and `workspace_invitations`, and replaces `workspace_members`' own Foundation-phase policies. Applied to a live, connected Supabase project.

| Table | Policy | Rule |
|---|---|---|
| `roles` | select only | `using (true)`, scoped `to authenticated` — global, non-Workspace-scoped reference data (no `workspace_id` column exists to scope by). **The sole, deliberate exception to this codebase's "no bare `using(true)`" convention** — justified because the catalog itself is non-sensitive and identical for every Workspace; no insert/update/delete policy, since only the seed migration ever writes to it. |
| `permissions` | select only | Same `using (true)`/`to authenticated` exception as `roles`, same justification. |
| `role_permissions` | select only | Same `using (true)`/`to authenticated` exception as `roles`/`permissions` — the default matrix itself is non-sensitive; per-member overrides (which *would* be sensitive) are explicitly out of scope this phase. |
| `workspace_invitations` | select/insert/update | Gated by `has_permission(workspace_id, 'team.invite')`, not bare `is_workspace_member()` — only a member with invite authority can list, create, or update (resend/revoke) a Workspace's invitations; a `staff` member with only `team.view` cannot enumerate pending invitations. No delete policy — an invitation is revoked (`status = 'revoked'`), never physically removed, preserving the audit trail. Anonymous token-based lookup/acceptance bypasses this table's RLS entirely via the two `security definer` RPCs (below), which is why those RPCs return only minimum-safe fields rather than relying on a permissive select policy. |
| `workspace_members` | select | **Replaced** from the Foundation-phase `is_workspace_member(workspace_id)` rule (any active member could see the roster) to `has_permission(workspace_id, 'team.view')` — every default role grants `team.view`, so this is not a practical narrowing today, but it means a future role that omits `team.view` is respected without a further RLS change. |
| `workspace_members` | insert/update/delete | **Replaced** from the Foundation-phase `has_workspace_role(workspace_id, ['owner','admin'])` array check to `has_permission(workspace_id, 'team.manage_roles')` — same practical effect today (only owner/admin hold that permission by default), but future roles can gain or lose team-management power by editing `role_permissions`, not by shipping a new RLS migration. |

Two reusable pieces back every check above (`supabase/migrations/20260724100600_role_permission_helper_functions.sql`):

- **`has_permission(p_workspace_id, p_permission)`** — the granular counterpart to `has_workspace_role()`: true iff `auth.uid()` has an `active` membership in the given Workspace whose role is granted that permission in `role_permissions`. Same `security definer`/`stable`/pinned-`search_path` shape as `is_workspace_member()`/`has_workspace_role()`, for the same recursion-avoidance reason.
- **`trg_protect_workspace_owners`** (`before update or delete on workspace_members`) and **`trg_validate_invitation_role_authority`** (`before insert on workspace_invitations`) — the last-owner-protection and role-escalation-prevention triggers described in "Team membership and invitations" above. Both `security definer`, pinned `search_path`, and narrowly scoped to exactly the invariant each enforces — RLS alone can express "who may write this row," but not "this specific write must never leave the table in an invalid state" (no owner, or a role promoted beyond the actor's own authority), which is what a trigger is for here.

`get_invitation_by_token` and `accept_workspace_invitation` (`supabase/migrations/20260724100500_invitation_helper_functions.sql`) are the two `security definer` RPCs used by the acceptance flow — see "Team membership and invitations" above for what each does and why `security definer` is the correct, narrowly-scoped choice for both (an unauthenticated or not-yet-a-member caller has no ordinary RLS path to authorize against). `get_invitation_by_token` is granted to `anon` as well as `authenticated`, since the invitation page must render before sign-in; `accept_workspace_invitation` is granted to `authenticated` only, since acceptance requires a signed-in identity to compare against the invited email.

`lib/data/team/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as every prior module — bundles Team Members and Invitations into one repository file since role/permission checks and invitation authority checks both need the same Workspace-membership context. No `service_role` is used anywhere in the Team foundation migration.

## Supabase RLS for Client Accounts + Invitations (live)

`supabase/migrations/20260725100700_client_access_rls.sql` enables RLS and defines the policies below on `client_accounts` and `client_invitations`. Applied to a live, connected Supabase project.

| Table | Policy | Rule |
|---|---|---|
| `client_accounts` | select (own row) | `auth_user_id = auth.uid()` — a Client Portal user reads only their own account row(s). No anonymous enumeration, no cross-client access. |
| `client_accounts` | select (team) | `has_permission(workspace_id, 'clients.portal_view')` — an internal team member with that permission reads every account in their Workspace, to manage Client Portal access from Client Detail. **Two permissive select policies, evaluated with OR semantics** — a genuine architectural difference from every other table in this schema, since a client and a team member are two entirely different, non-overlapping legitimate callers rather than one role check. |
| `client_accounts` | update | `has_permission(workspace_id, 'clients.portal_manage')` **or** `has_permission(workspace_id, 'clients.portal_suspend')` — gets a caller in the door; `trg_validate_client_account_action_authority` (below) enforces which specific permission a given transition actually needs. **No client-side update policy exists at all** — a client can never modify their own account's status directly, only through the token-validated `accept_client_invitation` RPC (which bypasses RLS as `security definer`). No insert policy — every row is created exclusively by that same RPC. No delete policy — suspension/revocation is terminal-but-reversible, never a physical delete. |
| `client_invitations` | select | `has_permission(workspace_id, 'clients.portal_view')` — internal-only, an external client never reads this table directly, only through the two token-based RPCs below. |
| `client_invitations` | insert/update | `has_permission(workspace_id, 'clients.portal_invite')` — same shape as `workspace_invitations`' single invite-authority permission, no separate "manage" tier for invitations themselves. No delete policy — an invitation's history is permanent. |

Three reusable pieces back every check above (`supabase/migrations/20260725100500_client_account_access_helper_functions.sql`):

- **`is_client_account_holder(p_client_id)`** — the Client Portal's direct analog of `is_workspace_member()`: true iff `auth.uid()` holds an `active` `client_accounts` row for that Client. Same `security definer`/`stable`/pinned-`search_path` shape. Not consumed by any business-module RLS policy yet (Leads/Clients/Events/Contracts/Finance/Documents remain Workspace-isolation-only, unchanged this phase) — built now as the minimal forward-looking helper a future Client Portal RLS phase can reuse directly.
- **`trg_validate_client_account_action_authority`** (`before update on client_accounts`) — a revoke or reactivate-from-revoked transition requires `clients.portal_manage` specifically; a suspend/reactivate-from-suspended transition accepts `clients.portal_suspend` or `clients.portal_manage`. Deliberately bypassed via a transaction-local flag when `accept_client_invitation` performs the reactivation itself, since that caller (the client accepting their own invitation) has no `workspace_members` row and therefore no `has_permission()` grant at all — judging that transition by this rule would incorrectly block a legitimate acceptance.
- **`touch_client_account_last_access()`** and **`get_current_client_account_context()`** — both narrowly-scoped `security definer` functions that only ever read/write the caller's own row, identified purely by `auth.uid()`, never a caller-supplied id. At the time this phase shipped, the latter was the sole path a Client Portal caller had to read even their own Client's display name, since `clients` RLS was Workspace-isolation-only. Superseded by the `clients_select_client_account` RLS policy once Client Portal MVP shipped (see "Client Portal MVP (live)" above) — a client can now read their own `clients` row directly; both functions remain in place unchanged.

`get_client_invitation_by_token` and `accept_client_invitation` (`supabase/migrations/20260725100400_client_invitation_helper_functions.sql`) are the two `security definer` RPCs used by the acceptance flow — same rationale as their Team-invitation counterparts, using their own errcode range (`P0101`–`P0107`, distinct from Team's `P0001`–`P0007`) so a caller inspecting a rejection code is never ambiguous about which flow it came from. `get_client_invitation_by_token` is granted to `anon` as well as `authenticated`; `accept_client_invitation` is granted to `authenticated` only.

`lib/data/clientAccess/supabaseRepository.ts` uses the **browser** Supabase client, same rationale as every prior module. No `service_role` is used anywhere in this migration set.

## Client Portal MVP (live)

**Live in Supabase mode** (`lib/data/clientPortal/`, `docs/workflows.md`'s "Client Portal MVP" section) — the real, business-data-facing external Client Portal: Overview, My Events, My Contracts, My Invoices, My Documents, Account. Consumes the account/invitation foundation above unchanged; adds no new tables, no second authentication system, and no reuse of the internal Team Portal shell.

**RLS design principle**: every new client-facing policy is a **separate, additive** `select` policy layered onto an already-live, Workspace-isolation-only table — never a `drop`/`alter` on an existing internal policy. Postgres evaluates multiple permissive policies with OR semantics, so an internal team member's existing access is completely unaffected; a client caller simply gets a second, narrower path to the same table. Confirmed both by direct `pg_policies` inspection and by a dedicated migration test asserting no `drop policy` appears anywhere in the new migration files.

`supabase/migrations/20260726100000_client_account_workspace_helper_function.sql` through `20260726100400_client_portal_document_storage_ref_function.sql` (5 migrations) add:

| Table | New policy | Rule |
|---|---|---|
| `clients` | `clients_select_client_account` | `is_client_account_holder_in_workspace(workspace_id, id)` |
| `events` | `events_select_client_account` | `is_client_account_holder_in_workspace(workspace_id, client_id)` |
| `contracts` | `contracts_select_client_account` | `is_client_account_holder_in_workspace(workspace_id, client_id)` |
| `invoices` | `invoices_select_client_account` | `is_client_account_holder_in_workspace(workspace_id, client_id)` |
| `payments` | `payments_select_client_account` | `is_client_account_holder_in_workspace(workspace_id, client_id)` — `payments.client_id` is its own `not null` column (not reached via a join to `invoices`), so this policy scopes directly off it, never a broader query. |
| `documents` | `documents_select_client_account` | `client_id is not null and visibility in ('client', 'client_and_team') and is_client_account_holder_in_workspace(workspace_id, client_id)` — the only policy in the schema combining ownership scoping with a `visibility` check; see "Documents visibility" below for how this changes that section's prior "nothing enforces `visibility` yet" claim. |
| `document_folders` | `document_folders_select_client_account` | A non-recursive `exists` subquery — a folder is visible only if it *directly* contains at least one document matching the `documents` policy's own predicate above. `document_folders` has no `client_id` column (only polymorphic `owner_type`/`owner_id`), so folder visibility is derived from its contents rather than a column it doesn't have. Deliberately does not traverse child folders — an accepted MVP scoping limit, not a bug. |

**Deliberately no client-facing policy exists on**: `leads`, `expenses` (has its own easy-to-miss `client_id` column, explicitly excluded), `notes`, `timeline_activities`, `workspace_members`, `workspace_invitations`, `client_invitations`, or any internal settings table. **No insert/update/delete policy was added anywhere** — the Client Portal is view-only this phase; e-signature, client document upload, and payment-provider integration all remain future scope.

**`is_client_account_holder_in_workspace(p_workspace_id uuid, p_client_id uuid)`** (new `security definer`/`stable`/pinned-`search_path` helper) checks `client_accounts` for `workspace_id = p_workspace_id and client_id = p_client_id and auth_user_id = auth.uid() and status = 'active'`. Redundant with `is_client_account_holder(p_client_id)` alone (a `client_id` already uniquely determines its `workspace_id`), but the explicit two-column check was chosen deliberately for defense-in-depth and auditability at every one of the 7 call sites above, over relying on `client_id` uniqueness alone.

**`get_client_document_storage_ref(p_document_id uuid)`** (new `security definer`, pinned `search_path`) is how a client downloads a Document's file without ever seeing a raw Storage path in the browser — the same two-step RPC-then-sign pattern the internal `getMediaAssetDownloadUrl()` already uses. Keyed **only** by `document_id` — it never accepts a caller-supplied `media_asset_id`, so a caller can never probe an arbitrary MediaAsset directly. Re-validates inline (it bypasses RLS as `security definer`, so it must check everything RLS would have): `auth.uid()` is not null, the document exists, `client_id is not null and visibility in ('client', 'client_and_team') and is_client_account_holder_in_workspace(...)`, and `media_asset_id is not null` with a real linked `media_assets` row. Returns **only** `storage_bucket`/`storage_path` — `lib/data/clientPortal/supabaseRepository.ts`'s `getClientPortalDocumentDownloadUrl()` immediately exchanges that for a real signed URL via `supabase.storage.from(bucket).createSignedUrl(path, 3600)` and returns only the signed URL string; the bucket/path never propagate past that one function, and never reach the UI.

**`ClientPortalRepository`** (`lib/data/clientPortal/`) — a new, bundled repository, wholly separate from every internal repository: it never calls `requireWorkspaceSession()` (a client caller has none), and every Supabase-mode query lists exact columns (never `select("*")`) so a future internal-only column is never accidentally forwarded. Client-safe DTO types (`src/types/clientPortal.ts`: `ClientPortalEvent`, `ClientPortalContract`, `ClientPortalInvoice`, `ClientPortalInvoiceWithPayments`, `ClientPortalPayment`, `ClientPortalDocument`, `ClientPortalOverview`) are their **own** types, not `Pick<Event, ...>` aliases, so a future internal field added to `Event`/`Contract`/etc. is never accidentally forwarded just because a `Pick` happened to reference it. `ClientPortalDocument` derives `hasFile: boolean` from `media_asset_id !== null` rather than exposing the id itself, and every Documents query (mock and Supabase) additionally filters to `is_latest_version = true` — a superseded version is never client-visible, per "no access to superseded versions unless business rules explicitly permit it."

**`ClientAccountSessionProvider`** (`components/providers/ClientAccountSessionProvider.tsx`) is the one canonical context every Client Portal page reads from — no page independently re-fetches account context. Exposes `authUserId`/`accountId`/`clientId`/`workspaceId`/`email`/`clientName`/`workspaceName`/`accountStatus`/`acceptedAt`/`lastAccessAt`/`isActive`/`canAccessPortal`/`logout`. `isActive`/`canAccessPortal` are always `true` in practice — `(client-portal)/layout.tsx` never mounts this provider for a blocked/missing/unauthenticated session, short-circuiting to `AccessBlockedPage` first — but are kept as explicit fields so a page can express "only render if accessible" without re-deriving the fact from `accountStatus` itself.

**Blocked states — audited and completed.** `resolveClientAccountSessionSnapshot()` now wraps its repository call in a try/catch, resolving a distinct `{ kind: "error" }` snapshot on a thrown failure rather than leaving an unhandled rejection that stranded the caller on the loading `Skeleton` indefinitely — found during a post-launch architecture audit, not present in the original design. `unauthenticated`/`no-account`/`blocked`/`error` are the full set of non-active outcomes; every one renders `AccessBlockedPage` with a `brandSuffix="Client Portal"` qualifier (a new, optional prop — unused by the internal Team Portal's own callers) so a blocked Client Portal page never reads as the bare internal brand.

**Route protection** — `/client-access`, `/client-access/events(/[id])`, `/client-access/contracts(/[id])`, `/client-access/invoices(/[id])`, `/client-access/documents(/[id])`, and `/client-access/account` all live under the `/client-access` prefix in `PROTECTED_ROUTE_PREFIXES` (`lib/middleware/routeProtection.ts`) — `matchesPrefix()`'s `startsWith(prefix + "/")` logic covers every sub-route automatically, confirmed by a dedicated test asserting each one is protected. A manipulated id in any detail route (an event/contract/invoice/document id belonging to another client, or that doesn't exist) resolves to zero rows via RLS, which the repository surfaces as the same `NotFoundError` a genuinely nonexistent id would produce — a client can never distinguish "this exists but isn't yours" from "this doesn't exist," since the former would leak another client's data's existence.

**Explicitly not built this phase**: payment-provider integration (Invoices/Payments remain view-only), client document upload or replacement (Documents remain view/download-only), e-signature infrastructure (Contracts remain view-only, even where `signature_status` exists), and notification preferences/MFA/billing-settings/account-deletion on the Account page.

## Client Portal administration (internal, live)

A new internal-only Sidebar group — **Client Portal** (`/client-portal`, `ClientAccountsAdminView.tsx`/`ClientInvitationsAdminView.tsx`) — deliberately separate from **Clients** (the CRM module): distinguishes "the relationship record" from "external account/access administration for that record." Reuses every existing granular permission unchanged — no new permission was added. Route access: `/client-portal` requires `clients.portal_view` (`core/permissions/routeAccess.ts`, the same "granted to every role" precedent as `/team`'s `team.view`), covering both `/client-portal/accounts` and `/client-portal/invitations` via prefix match; action-level gating within each page reuses `clients.portal_suspend`/`clients.portal_manage` (accounts) and `clients.portal_invite` (invitations) exactly as `ClientAccessSection` already does on Client Detail. Both pages read/write through `ClientAccessRepository` unchanged — no new repository function, no schema or RLS change.

## Supabase Row-Level Security for future business tables (planned)

Every Phase 1 MVP module (Leads, Clients, Events, Contracts, Finance, Documents, plus the Media Library), the Team foundation, Client Accounts + Invitations, and Client Portal MVP now has live RLS, per the sections above. Once a further, post-MVP module's own migration phase begins (Team Portal persona invitations, Knowledge Base, Notification Center, Automation Center — see `docs/integrations.md`), RLS policies for that module are expected to enforce:

- Every table with `workspace_id` — a row is only visible/writable to authenticated users belonging to that `workspace_id`, using the same `is_workspace_member()`/`has_workspace_role()`/`has_permission()` helpers documented above rather than duplicating the check.
- Role/permission distinctions enforced via `has_permission(workspace_id, ...)` (preferred, granular — see "Granular permissions" above) rather than a hardcoded `has_workspace_role()` role array, where that module's spec calls for it (Leads/Clients/Events/Contracts/Finance/Documents above deliberately do not — Workspace isolation only, unaffected by the Team foundation).

## Storage Foundation (one live bucket, plus one reserved for future user avatars)

`supabase/migrations/20260715150700_storage_buckets_and_policies.sql` created two **private** (`public = false`) Storage buckets and their `storage.objects` policies. `supabase/migrations/20260719100100_media_assets_bucket_and_storage_policies.sql` added a third, dedicated bucket for the Media Library. The original `documents` bucket from the first migration was never used — Documents' own migration routed every file through the Media Library's `media-assets` bucket instead (see `docs/database.md`'s `media_assets` section) rather than duplicating a second binary-upload implementation. Its removal is a **Storage administration step, not a SQL migration** — Supabase's hosted Postgres rejects a direct `delete from storage.buckets` inside a migration ("Direct deletion from storage tables is not allowed. Use the Storage API instead."), so the unused bucket (and its 4 policies) is removed via the Storage Management API/CLI once confirmed unused, separately from `supabase/migrations/20260722100200_media_library_document_integration.sql`, which only widens `media_assets_owner_type_check`. No second Storage bucket is introduced either way — every Document file lives in `media-assets` from this phase forward regardless of when the cleanup runs.

| Bucket | Path convention | Access rule |
|---|---|---|
| `avatars` | `{user_id}/{file_name}` | select/insert/update/delete require the path's first segment to equal `auth.uid()`. Reserved — no avatar upload UI exists yet. |
| `media-assets` | `{workspace_id}/{owner_type}/{owner_id}/{media_asset_id}/v{version}/{stored_filename}` | select/insert/update/delete require `is_workspace_member()` on the path's first segment (the `workspace_id`), parsed via `storage.foldername(name)`. **Live and used** by `lib/data/media/supabaseRepository.ts`'s upload/download/replace-version functions — the sole file-storage bucket for every module, including Documents. |

No bucket permits anonymous read, and none is ever expected to hand out a permanent public URL. The access model is **short-lived signed URLs**, generated per-request and scoped to the requester's already-established Workspace membership/role (`getMediaAssetDownloadUrl`) — never a bare public bucket URL embedded in a page. This mirrors the same principle documented for the Documents domain below.

## Documents visibility

`documents.visibility`/`document_folders.visibility` (`internal`, `client`, `team`, `client_and_team`, `restricted` — `core/enums/documentVisibility.ts`) are now enforced for exactly one reader: the Client Portal (see "Client Portal MVP (live)" above) — `documents_select_client_account` only ever matches a row where `visibility in ('client', 'client_and_team')`. For every **internal** (team-member) reader, `visibility` remains descriptive only — the existing `is_workspace_member(workspace_id)` policy still lets any Workspace member read any Document regardless of its `visibility`, unchanged by this phase. This was a deliberate scoping choice, not an oversight: enforcing `visibility` for internal readers too (a `team`/`client_and_team`-only filter once a Team Portal role exists) remains future scope, tracked separately from the client-facing enforcement that now exists.

Security principles this domain is built around, ahead of Portal-level enforcement:

- **Metadata and binary storage are fully separated**, and a Document consumes the Media Library rather than owning any storage logic itself. A `documents` row is queryable/listable without ever touching Storage; the physical file (a `media_assets` row, linked via `media_asset_id`) is never fetched without first resolving the owning `documents` row and its Workspace RLS. No document-specific upload path, checksum logic, or Storage bucket exists — see `docs/database.md`'s `documents`/`media_assets` sections.
- **No document is public by default.** The narrowest practical `visibility` (`internal`) is the schema default expectation; nothing here defaults to a public/unauthenticated read.
- **No permanent public file URLs.** Access to a linked file goes through the Media Library's short-lived signed URLs (`getMediaAssetDownloadUrl`), generated per-request and scoped to the requester's Workspace membership — never a bare public bucket URL embedded in a page.
- **Workspace isolation.** Every Document/Folder query is scoped by `workspace_id` in addition to `owner_type`/`owner_id`, the same polymorphic-ownership discipline as `notes`/`timeline_activities` (`docs/database.md`), and is now backed by live RLS (see "Supabase RLS for Documents" above).
- **Soft deletion, not physical deletion.** A `deleted` Document remains in the store and auditable; nothing is unrecoverably destroyed by this domain, and no delete RLS policy exists on either `documents` or `document_folders`.
- **Audit trail.** Every lifecycle transition (created, metadata updated, activated, versioned, superseded, expired, archived, restored, soft-deleted, visibility changed, moved to folder) is recorded on the Document's own Timeline (`owner_type = 'document'`) — see `docs/workflows.md`'s Documents section.
- **Checksums are real SHA-256 digests of actual file bytes**, computed by the Media Library (`src/lib/media/checksum.ts`) — a Document with a linked `media_asset_id` inherits a genuine checksum, not a placeholder; a metadata-only Document (no file attached) simply has none.
- **No executable uploads, ever.** `exe`/`dmg`/`pkg`/`app`/`js`/`sh`/`bat`/`cmd` are blocked at the Media Library's validation layer (`src/lib/media/mediaFile.ts`) regardless of role, owner type, or visibility — enforced once, for every consumer, not duplicated per module.
- **No client-visible access without an explicit `visibility` value permitting it** — live now: `documents_select_client_account` only matches `visibility in ('client', 'client_and_team')`, so a Document defaulting to `internal` is never accidentally exposed to a Client Portal session.

`documents`/`document_folders` RLS for an **internal** reader still enforces Workspace isolation only (above) — a `client`/`client_and_team`-visible row is not separately restricted at the policy level from an `internal`/`restricted` one for a team member; any authenticated member of the Workspace can read all of them today, unchanged. For the **Client Portal** reader, `visibility`-aware filtering is now live (see "Client Portal MVP (live)" above): a client sees only `client`/`client_and_team`-visible rows scoped to their own `client_id`, never `internal`/`restricted`/`team`-only rows. A `team`/`client_and_team`-visible row readable by a future Team Portal role (scoped filtering for that reader) remains future scope.

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
- Custom/configurable roles (a fifth role can be added by inserting a `roles` row and a `role_permissions` set — see "Granular permissions" above — but there is no self-service "create a role" UI or arbitrary per-Workspace role customization)
- Member-specific permission overrides (a member's permissions come entirely from their role today; documented as future scope, not built — see "Granular permissions" above)
- Wiring `has_permission()` into business-module RLS (Leads/Clients/Events/Contracts/Finance/Documents remain Workspace-isolation-only; the granular catalog governs UI-level route/action gating via the Team Portal MVP, not RLS, for those modules)
- A production email provider for invitations (Resend, SendGrid, Mailgun, Postmark, or otherwise) — the live internal-invitation and Client invitation flows generate a link and offer a dev-safe copy-link UI instead; see "Email sending" above
- Client Portal payment-provider integration (Invoices/Payments are view-only for a client), client document upload/replacement (Documents are view/download-only for a client), and e-signature infrastructure (Contracts are view-only for a client) — the read-only Client Portal MVP itself is live (see "Client Portal MVP (live)" above); only these write-capable extensions remain future scope.
- Enforcing `documents`/`document_folders` `visibility` for an **internal** (team-member) reader beyond plain Workspace isolation — live now only for the Client Portal reader (see "Documents visibility" above); a future Team Portal role's own `team`/`client_and_team`-scoped filtering is not built yet.
- Team Portal persona invitations — a scoped-down, non-full-member internal tier (e.g. day-of staff/contractors); the architecture is documented above ("Team Portal invitations") but nothing is built. Distinct from the live internal `workspace_invitations` flow (full owner/admin/manager/staff members) and the live `client_invitations` flow (external clients) — neither needed a `service_role` admin client, and this future scope is expected not to either.
- Team Knowledge Base and Client Knowledge Base: any table, migration, RLS policy, route, UI, or CMS — the architecture is documented above ("Team Knowledge Base and Client Knowledge Base") but nothing is built; reserved for a Future Phase after Documents
- Notification Center: any table, migration, RLS policy, route, UI, component, notification, or delivery channel integration — the architecture is documented above ("Notification Center") but nothing is built; reserved for a Future Phase after Client Knowledge Base, before Settings
- Automation Center: any table, migration, RLS policy, route, UI, component, workflow engine, or third-party integration (Slack, Discord, Google Calendar, Google Drive, Stripe, webhooks) — the architecture is documented above ("Automation Center") but nothing is built; reserved for a Future Phase after Notification Center
