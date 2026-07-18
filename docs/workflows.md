# Workflows

This document defines the event lifecycle in operational detail: what each stage means, when it starts and ends, and what has to be true to move forward. It expands on the lifecycle summary in `BLOOMOS_BIBLE.md` — that file is the source of truth for terminology; this file is the source of truth for the transition rules.

## The lifecycle

```
Lead → Client → Consultation → Proposal → Contract → Deposit
     → Planning → Inventory → Team → Event Execution
     → Gallery → Feedback → Returning Client
```

## Stage definitions

### 1. Lead
**Entry:** A prospect makes contact (form, referral, inquiry).
**Activity:** Qualify — is this a real fit (budget, timeline, event type)?
**Exit:** Either `disqualified` (lifecycle ends here) or `converted` → becomes a Client.

### 2. Client
**Entry:** Lead is converted.
**Activity:** A `clients` record now exists, independent of any single event. This is the durable relationship record — it outlives any one event.
**Exit:** Immediately proceeds to Consultation for their first (or next) event.

### 3. Consultation
**Entry:** Client agrees to a discovery conversation.
**Activity:** Capture vision, budget, requirements, constraints.
**Exit:** Enough information exists to draft a Proposal.

### 4. Proposal
**Entry:** Consultation complete.
**Activity:** Formal scope + concept + pricing presented to the client.
**Exit:** Client approves (→ Contract) or declines (event lifecycle ends, client record remains).

### 5. Contract
**Entry:** Client approves the proposal.
**Activity:** Agreement drafted, sent, and signed.
**Exit:** Contract signed → triggers Deposit.

### 6. Deposit
**Entry:** Contract signed.
**Activity:** Initial payment collected to secure the booking.
**Exit:** Deposit paid → event moves into active Planning.

### 7. Planning
**Entry:** Deposit received.
**Activity:** Timeline, logistics, and details are built out. This stage runs in parallel with Inventory and Team allocation (post-MVP modules).
**Exit:** Event date arrives, execution begins.

### 8. Inventory *(post-MVP)*
**Activity:** Physical/rental assets are allocated to the event.
**Relationship to lifecycle:** Runs alongside Planning, not strictly after it.

### 9. Team *(post-MVP)*
**Activity:** Staff/vendors are assigned to execute the event.
**Relationship to lifecycle:** Runs alongside Planning, not strictly after it.

### 10. Event Execution
**Entry:** Event date/time arrives.
**Activity:** Live delivery of the event.
**Exit:** Event concludes.

### 11. Gallery
**Entry:** Event concludes.
**Activity:** Photos/media are curated and delivered to the client.
**Exit:** Gallery delivered.

### 12. Feedback
**Entry:** Gallery delivered.
**Activity:** Client review/testimonial collected.
**Exit:** Feedback received (or a reasonable window elapses).

### 13. Returning Client
**Entry:** A client with a completed event lifecycle initiates a new engagement.
**Activity:** They re-enter the lifecycle at Consultation (or Proposal, if scope is already clear) — but their Client record, history, and preferences carry forward. A new `events` row is created; the `clients` row is reused.

## MVP note on stage coverage

The single-stage `lifecycle_stage` model above (`lead` → ... → `completed`) was the original design sketch. As actually implemented (`core/workflows/eventWorkflow.ts`), an Event tracks **two independent state machines** instead of one combined stage, so operational booking state and planning-pipeline position can move at different paces without one value having to encode both:

- **`status`** — the booking/operational state: `draft`, `inquiry`, `awaiting_contract`, `awaiting_deposit`, `confirmed`, `planning`, `ready`, `in_progress`, `completed`, `cancelled`, `archived`. `completed`/`cancelled`/`archived` are terminal, reachable only via their own dedicated action (`completeEvent`/`cancelEvent`/`archiveEvent`), never the plain status selector — same pattern as `leads.status`.
- **`lifecycle_stage`** — where the Event sits in the planning pipeline: `intake`, `proposal`, `booking`, `planning`, `preparation`, `setup`, `execution`, `live_event`, `breakdown`, `post_event`, `closed`. `closed` is the only terminal stage; unlike `status`'s terminal values it's reached through the ordinary selector (there's no separate "close" action), but can't be left once entered.

Neither is inferred from the other by string matching — each has its own transition table and its own setter, consumed identically by the data layer (`lib/data/index.ts`) and any future Event UI. Inventory and Team remain future sub-modules that run alongside Planning/Preparation rather than separate stages, as originally noted; Vendors, Vehicles, and Automation are anticipated to attach to an Event the same way (see the polymorphic `checklist_items`/`schedule_items` ownership note in `docs/database.md`) rather than requiring new lifecycle stages.

A companion, deterministic `getEventHealthScore()` (`core/workflows/eventHealth.ts`) produces a 0–100 score from the same kind of signals (missing location/budget, missing/overdue checklist, missing schedule, awaiting contract/deposit, critical priority, an approaching date, a completed event missing its post-event review) — preparation for a future Dashboard/detail-page widget, not wired into any UI yet.

## Contracts

**Live in Supabase mode** (`lib/data/contracts/`, `docs/database.md`) — fourth business module migrated, same repository pattern as Leads/Clients/Events, bundling Contracts, Contract Templates, Contract Exhibits, and Contract Notes/Timeline into one repository pair. The workflow rules below apply identically regardless of data mode; nothing here changed for the migration.

As implemented (`core/workflows/contractWorkflow.ts`), a Contract tracks **two independent state machines**, the same pattern as an Event's `status`/`lifecycle_stage`:

- **`status`** — the contract's overall commercial lifecycle: `draft`, `review`, `ready`, `sent`, `viewed`, `signed`, `completed`, `expired`, `cancelled`, `archived`, `declined`. `draft`/`review`/`ready` remain freely inter-transitionable through the plain status setter (`updateContractStatus`); every other value is reachable only through its own dedicated data-layer action (`sendContract`, `markViewed`, `markSigned`, `completeContract`, `expireContract`, `cancelContract`, `archiveContract`, `markDeclined`) and never left again except by a further dedicated action.
- **`signature_status`** — specifically the e-signature process: `unsigned`, `sent`, `viewed`, `partially_signed`, `signed`, `declined`, `expired`, `cancelled`. Moves in lockstep with `status` through the dedicated actions above, except it can additionally reach `partially_signed` — a state `status` has no equivalent for, reserved for a future multi-signer scenario no action currently sets.

Neither is inferred from the other. `isContractClosed()` identifies the narrower set of statuses with genuinely nothing left to do (`completed`, `expired`, `cancelled`, `archived`, `declined`) — distinct from "locked" (entry-restricted to a dedicated action), since a `sent`/`viewed`/`signed` contract is locked from the plain setter but still very much mid-flow. `getContractNextRecommendedAction()` (mirroring `getEventNextRecommendedAction`/`getNextRecommendedAction`) returns a deterministic suggestion for every non-closed status, including flagging a `sent` contract that has passed its `expiration_date`.

A Contract always belongs to a Client (`client_id` required); `event_id` is deliberately optional, so a Contract can stand on its own (e.g. a retainer) ahead of or without a dedicated Event record — never assume the Lead → Client → Event → Contract chain is fully populated. If `event_id` is set, it must belong to the same `client_id` (data-layer validated on both create and update).

## Finance

**Live in Supabase mode** (`lib/data/finance/`, `docs/database.md`) — fifth business module migrated, same repository pattern as Leads/Clients/Events/Contracts, bundling Invoices, Payments, Expenses, and their Notes/Timeline into one repository pair. The workflow rules below apply identically regardless of data mode; nothing here changed for the migration.

Continues the cycle Contract closes: Lead → Client → Event → Contract → Invoice → Payments → Expenses → Profit. Three independent models, each with its own state machine (`core/workflows/invoiceWorkflow.ts` / `paymentWorkflow.ts` / `expenseWorkflow.ts`):

- **Invoice** (`draft`, `issued`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `voided`, `archived`) — unlike Contract/Event, there is **no plain status setter**. Every non-`draft` value is reached only through its own dedicated data-layer action (`issueInvoice`, `sendInvoice`, `markInvoiceViewed`, `markInvoiceOverdue`, `voidInvoice`, `archiveInvoice`, `restoreInvoice`) or automatically when a successful Payment is applied (`partially_paid`/`paid`, recomputed fresh from every linked Payment each time one changes — the mock's `applyPaymentToInvoice` in `lib/data/finance/mockRepository.ts`, or the atomic `recompute_invoice_balance` Postgres function in Supabase mode, see `docs/database.md`). `client_id` is required; `event_id`/`contract_id` are optional but must belong to the same client when set.
- **Payment** (`pending`, `processing`, `succeeded`, `failed`, `partially_refunded`, `refunded`, `cancelled`) — `succeeded` is deliberately not terminal (it can still move to `partially_refunded`/`refunded`, the same way a signed Contract can still be cancelled). Only `succeeded`/`partially_refunded`/`refunded` count toward an Invoice's paid total. `invoice_id` is optional (a Payment may exist standalone), but `client_id`/`workspace_id` are always required and validated for consistency against any linked Invoice/Event/Contract.
- **Expense** (`planned`, `approved`, `due`, `paid`, `reimbursed`, `cancelled`, `archived`) — every non-`planned` value is reached only through its own dedicated action (`approveExpense`, `markExpenseDue`, `markExpensePaid`, `markExpenseReimbursed`, `cancelExpense`, `archiveExpense`, `restoreExpense`). `event_id`/`client_id` are both optional (a general business expense has neither); `supplier_id`/`team_member_id` are unvalidated forward-looking placeholders.

Money is always an integer minor-unit amount (`lib/money.ts`) — see `docs/database.md`'s "Money model" section. Refunds are a Payment with `payment_type: "refund"`, not a second ledger — see `docs/database.md`'s "Refund model" section for the exact mechanics. `modules/finance/eventFinancialStatus.ts`'s `EventFinancialStatus` is derived on every read from an Event's Contracts/Invoices/Payments, never persisted — see `docs/database.md`'s "Derived Event financial status" section.

## Documents

The single shared file system every other module attaches files through — see `docs/database.md`'s `documents`/`document_folders` sections for the full column reference. Two independent state machines, neither inferred from the other:

- **Document** (`core/workflows/documentWorkflow.ts`) — `draft`, `active`, `superseded`, `expired`, `archived`, `deleted`. Every non-`draft` value is reached only through its own dedicated action (`activateDocument`, `createDocumentVersion` marks the prior latest version `superseded`, `expireDocument`, `archiveDocument`, `softDeleteDocument`). Only `deleted` is terminal (`isDocumentTerminal`); `archived`/`deleted` both restore to `active` via `restoreDocument` — the same "reasonable resumption point" precedent as `restoreContract`/`restoreExpense`. `getDocumentNextRecommendedAction()` returns a deterministic suggestion for every status, including flagging incomplete metadata on a draft (uncategorized or unfiled) and an active Document expiring within 14 days.
- **Document Folder** — no status enum; archiving is `archived_at`-based only (`archiveDocumentFolder`/`restoreDocumentFolder`) and does not cascade to child folders or the Documents inside. Folder-tree rules (nesting, cycle prevention, cross-Workspace/cross-owner move guards) are centralized in `core/workflows/documentFolderWorkflow.ts` and never reimplemented by a caller.

No money model applies here (Documents carry no monetary fields). Real file storage, upload, download, and checksum verification are live — via the Shared Media Library (`docs/database.md`'s `media_assets` section), which a Document links to through `media_asset_id` rather than owning any storage logic itself. No OCR, e-signature, or PDF generation exists in this phase.

## Team Knowledge Base (architecture, planned — not implemented, Future Phase after Documents)

Reserved as a future module, not started. A private, internal-only knowledge center where the team documents everything needed to work consistently: Company Rules, Employee Handbook, Team Policies, SOPs, Decoration Guidelines, Proposal Setup Checklist, Hotel Decoration Procedures, Luxury Picnic Procedures, Photography Guidelines, Customer Service Standards, Emergency Procedures, Cleaning Checklist, Inventory Instructions, Internal Announcements, Team Training, Video Tutorials, FAQ for Employees.

Eventually expected to support: categories, a rich text editor, image/PDF/video attachments, search, tags, version history, author attribution, "last updated," read tracking, featured articles, role permissions, and a draft/published state — see `docs/database.md`'s `team_kb_articles` sketch. Deliberately **not** merged with Documents (Documents are files; this is structured, versioned, educational content — a different concept), Clients, the future Team Management module, or Contracts. Visibility: authenticated internal team members only, once real role-scoped access exists.

## Client Knowledge Base (architecture, planned — not implemented, Future Phase after Team Knowledge Base)

Reserved as a future module, not started. A self-service knowledge base for clients (a "help center" experience, in the sense of what it does — the canonical module name remains Client Knowledge Base), meant to answer common questions before they contact the company: Frequently Asked Questions, Payment Policies, Cancellation Policy, Rescheduling Policy, Refund Policy, Event Preparation Guide, Welcome Guide, How the Process Works, Timeline Expectations, Contract Explanation, Delivery Information, After Your Event, Contact Information.

Eventually expected to support: categories, a rich text editor, image/PDF/video attachments, search, featured articles, related articles, popular articles, and helpful/not-helpful voting, plus a draft/published state — see `docs/database.md`'s `client_kb_articles` sketch. Deliberately **not** merged with Documents, Clients, or the Team Knowledge Base above — different audience, different visibility model (gated by the future Client Portal), different feature set. Visibility: clients only, via the future Client Portal.

## Notification Center (architecture, planned — not implemented, Future Phase after Client Knowledge Base, before Settings)

Reserved as a future module, not started — the intended single source of truth for every internal and external notification in BloomOS. **Architecture rule**: notifications must never be hardcoded inside an individual module; every future module is expected to publish an event instead, and the Notification Center alone decides who receives it, which channel(s) are used, and which template is rendered. See `docs/database.md`'s `notifications`/`notification_templates`/`notification_preferences`/`notification_deliveries` sketches.

Internal notification events anticipated: New Lead Created, Lead Assigned, Client Converted, Contract Signed, Payment Received, Payment Failed, Event Scheduled, Event Reminder, Document Uploaded, Team Member Invited, Team Member Accepted Invitation, Knowledge Base Updated, Inventory Low, Invoice Due, New Message, New Comment, Automation Completed.

Client-facing notification events anticipated: Welcome Email, Payment Reminder, Proposal Approved, Contract Ready, Contract Signed, Event Reminder, Thank You Message, Review Request, Invoice Available.

Delivery channels anticipated (not all implemented immediately): In-App, Email, SMS, Push, Slack, Discord, WhatsApp. Notification types: Information, Success, Warning, Error, Reminder, Announcement.

Eventually expected to support: unread count, mark as read/mark all as read, archive, delete, priority, scheduled notifications, recurring notifications, notification history, attachments, deep links, a related-entity link (polymorphic, same discipline as Notes/Timeline), filters, categories, and search. Admin-only future capabilities: notification templates, enable/disable templates, preview notifications, broadcast announcement, maintenance alerts.

## Automation Center (architecture, planned — not implemented, Future Phase after Notification Center)

Reserved as a future module, not started — the intended orchestration engine of BloomOS. **Architecture rule**: every business module emits events; the Automation Center listens and decides what actions happen automatically; business modules must never contain automation logic directly. See `docs/database.md`'s `automation_workflows`/`automation_steps`/`automation_runs`/`automation_run_logs`/`automation_variables`/`automation_templates` sketches.

Event sources anticipated: Lead Created, Lead Updated, Lead Converted, Client Created, Client Archived, Contract Created, Contract Signed, Invoice Issued, Invoice Paid, Payment Failed, Event Scheduled, Event Completed, Document Uploaded, Knowledge Base Updated, Team Member Invited, Inventory Low, Notification Delivered.

Supported actions anticipated: Create Notification, Send Email, Send SMS, Send WhatsApp, Create Timeline Entry, Create Internal Task, Assign User, Update Record, Move Pipeline Stage, Generate Document, Generate Invoice, Generate Contract, Call External API, Webhook, Slack, Discord, Google Calendar, Google Drive, Stripe.

Workflow model anticipated (none designed yet): Trigger, Conditions, Filters, Variables, Delays, Wait Until, Branching, Loops, Approval Steps, Manual Review, Retries, Timeouts, Error Handling.

Worked examples, illustrating intent only (no workflow engine exists):

```
Lead Created → Assign Sales Owner → Send Welcome Email → Create Follow-up Task → Notify Team

Invoice Paid → Update Financial Status → Notify Client → Generate Receipt → Update Dashboard

Contract Signed → Mark Event Confirmed → Create Preparation Checklist → Notify Team → Notify Client
```

Execution modes anticipated: Immediate, Scheduled, Recurring, Manual. Every execution is eventually expected to log: Execution Status, Execution Time, Duration, Triggered By, Workflow Version, Error Message, Retry Count — see `automation_runs`/`automation_run_logs` in `docs/database.md`.

**Relationship to Notification Center**: the Automation Center is expected to publish to the Notification Center, Timeline, Documents, future Integrations, and business modules — but must never duplicate Notification Center logic. The Notification Center remains responsible only for delivery; the Automation Center only decides that a notification should happen and hands it off.

## Auth & session (Supabase Foundation)

Active only when `NEXT_PUBLIC_DATA_MODE=supabase`; in `mock` mode (the default) none of this runs. Leads, Clients, Events, Contracts, Finance, Documents, and Team (members + invitations) are wired to live Supabase (`docs/integrations.md`) — every Phase 1 MVP business module plus the Team foundation — including Lead → Client conversion (`convert_lead_to_client`), atomic default-checklist application (`apply_default_event_checklist`), collision-safe contract/invoice numbering (`generate_contract_number`/`generate_invoice_number`), atomic payment application/refund (`recompute_invoice_balance`/`process_payment_refund`), atomic Document version creation (`create_document_version`), atomic default folder-template application (`apply_default_folder_template`), and atomic invitation lookup/acceptance (`get_invitation_by_token`/`accept_workspace_invitation`, see `docs/database.md`). No business module still runs on the mock data layer regardless of this setting.

- **Sign in** (`signInWithPassword`, `lib/auth/actions.ts`) — email/password only. On success, redirects to the `redirectTo` query param if it's a same-origin path (`safeRedirectTarget` rejects anything not starting with `/`, and rejects `//` to block protocol-relative external redirects), otherwise `/dashboard`.
- **Sign up** (`signUpWithPassword`) — email/password account creation, used by the invitation acceptance page for a recipient with no existing account. Redirects to `redirectTo` only when Supabase returns an immediate session (an auto-confirm project); otherwise returns success without redirecting, so the caller can show a "check your email" state — a project may or may not require email confirmation, and this Server Action doesn't assume either.
- **Route protection** (`src/middleware.ts` + pure `lib/middleware/routeProtection.ts`) — on every request to a protected route prefix (`/dashboard`, `/account`, `/leads`, `/clients`, `/events`, `/contracts`, `/finance`, `/documents`, `/team`) without a session, redirects to `/sign-in?redirectTo=<original path>`, preserving the intended destination for sign-in to return to. Auth routes themselves (`/sign-in`, `/reset-password`, `/update-password`, `/auth/callback`, `/invitations`) are always allowed regardless of session state, which is what prevents a redirect loop — `/invitations/[token]` in particular must render and offer sign-up/sign-in before any session exists, so it lives outside route protection entirely rather than being an exception carved into it. This middleware-level check only ever confirms "is there a session" — the finer-grained "does this member have the specific permission this route needs" check is a separate, page-level concern; see "Team Portal" below.
- **Session refresh** (`lib/supabase/middleware.ts`) — runs on every matched request when in `supabase` mode, refreshing the Supabase session cookie before the route-protection decision is made.
- **Sign out** (`signOut`) — clears the session, redirects to `/sign-in`.
- **Password reset** is two steps, both Server Actions: `requestPasswordReset` emails a link that lands on `/auth/callback?next=/update-password` (the callback route exchanges the code for a session), then `updatePassword` sets the new password and redirects to `/sign-in`.
- **`getCurrentUser()`** (`lib/auth/session.ts`) is the preferred read for any auth-gating decision — it revalidates the token against Supabase Auth rather than trusting the (spoofable) session cookie the way `getSession()` does.
- Every Supabase Auth/Postgres error surfaced by any of the above is passed through `normalizeSupabaseError` (`lib/supabase/errors.ts`) first — a raw database/auth error message never reaches a form's error state.

## Team membership and invitations (Team foundation — live)

**Live in Supabase mode** (`lib/data/team/`, `docs/database.md`'s "Team foundation" section) — internal team identity/membership/role/permission/invitation foundation, built independently of (and ahead of) Client Portal/Team Portal. See `docs/permissions.md` for the full role/permission matrix and RLS design; this section covers the invitation state machine and the acceptance flow, mirroring how Contracts/Invoices/Documents document their own lifecycles above.

**Roles**: `owner`, `admin`, `manager`, `staff` — a flat set with no per-member permission overrides. A `workspace_members.role` value always maps to a fixed set of granular permissions (`lib/team/permissionMatrix.ts`'s `DEFAULT_ROLE_PERMISSIONS`, mirrored by the `role_permissions` seed data in Supabase mode) rather than being checked by name — `has_permission(workspace_id, permission)` is the canonical check everywhere, `has_workspace_role()` is reserved for the few places role identity itself (not a granted capability) is what matters, like owner-only branding.

**Invitation statuses** (`core/workflows/invitationWorkflow.ts`, `core/enums/invitationStatus.ts`): `pending`, `accepted`, `expired`, `revoked`. `pending` is the only status a new invitation ever starts in; every other status is a terminal off-ramp enforced by `canTransitionInvitationStatus`/`isInvitationTerminal`:

| From | Legal next states |
|---|---|
| `pending` | `accepted` (recipient completes acceptance), `expired` (time limit passed unaccepted), `revoked` (an authorized member cancels it) |
| `accepted` | *(terminal — the invitation's job is done; the resulting `workspace_members` row's own `status` — `active`/`suspended` — governs access from here, not the invitation)* |
| `expired` | *(terminal — a new invitation must be created; an expired one is never silently reactivated)* |
| `revoked` | *(terminal — same as `expired`)* |

Resending a `pending` invitation (`resendWorkspaceInvitation`) does not change its status — it supersedes the invitation's token and `expires_at` in place, so the old link stops working the moment a new one is issued, without creating a second row or touching the lifecycle above.

**Token security**: an invitation's raw token is generated once (32 random bytes, base64url-encoded, `lib/team/invitationToken.ts`) and returned to the caller exactly once, at creation/resend time — only its SHA-256 hash (`token_hash`) is ever persisted, in Supabase and mock mode alike. Lookup and acceptance re-hash the caller-supplied raw token to compare against `token_hash`; there is no code path that reads a raw token back out of storage.

**Acceptance flow** (`/invitations/[token]`, `InvitationAcceptanceView.tsx`): the page validates the token (`getInvitationByToken` — Supabase mode calls the `get_invitation_by_token` RPC, safe for an anonymous caller since it returns only the minimum fields needed to render the invite: workspace name, invited email, invited role, status, expiry), shows the Workspace name/invited email/role, and offers sign-up (`signUpWithPassword`) or sign-in (`signInWithPassword`) if the visitor has no session yet. Once authenticated, acceptance (`acceptWorkspaceInvitation`) is atomic and re-validates everything server-side regardless of what the page already displayed: the invitation must still be `pending` and unexpired, and the authenticated caller's email must match the invited email exactly — a mismatch is rejected even if the visitor is signed in as *some* valid workspace member. On success the invitation flips to `accepted` and a `workspace_members` row is created directly with `status: 'active'` in the same transaction (Supabase mode: the `accept_workspace_invitation` RPC, row-locked to prevent a double-accept race) — there is no intermediate `invited` membership row; `workspace_members.status = 'invited'` remains reserved but unused by this flow.

**Invariants enforced below the application layer** (triggers + constraints, not just workflow code — see `docs/database.md`): at most one `pending` invitation per Workspace/email at a time (partial unique index); an accepted/expired/revoked invitation can never be re-accepted (checked inside `accept_workspace_invitation` itself, not just by the TypeScript status machine above); a workspace's last `owner` can never be removed, demoted, or suspended (`trg_protect_workspace_owners`); an `admin` cannot invite or promote anyone to `owner`, and only an `owner` can invite/promote to `owner` or `admin` (`trg_validate_invitation_role_authority`) — role-escalation-by-invitation and role-escalation-by-membership-update are both blocked, not just by RLS but at the trigger level, so the invariant holds even against a bug in a future RLS policy.

Every invitation-lifecycle transition and every membership role/status change is expected to eventually record a Timeline entry via the existing `recordTimelineActivity` mechanism, same as every other module — not yet wired into the Team foundation's minimal UI scope, since `workspace_members`/`workspace_invitations` are not (and are not planned to become) polymorphic Notes/Timeline owner types the way Leads/Clients/Events/Contracts/Finance/Documents are.

## Team Portal MVP (live)

The authenticated internal app shell, made permission-aware — consumes the Team foundation above (roles/permissions/`workspace_members`) rather than introducing a second identity or authorization system. Explicitly out of scope this phase: Client Accounts, a Client Portal, a Team Knowledge Base, a Client Knowledge Base, a Notification Center, an Automation Center, and a full Team Portal navigation shell beyond what's described here.

**Route-access model** (`core/permissions/routeAccess.ts`) — one central map from route prefix to requirement (`{ kind: "active-membership" }` or `{ kind: "permission"; permission }`), never a permission field scattered across components:

| Route | Requirement |
|---|---|
| `/dashboard` | active membership only |
| `/account` | active membership only |
| `/leads` | `leads.view` |
| `/clients` | `clients.view` |
| `/events` | `events.view` |
| `/contracts` | `contracts.view` |
| `/finance` | `finance.view` |
| `/documents` | `documents.view` |
| `/team` | `team.view` |
| `/settings` | `workspace.manage` (reserved — no Workspace Settings page exists yet) |

`getRouteAccessRequirement(pathname)` matches by longest prefix, so `/finance/invoices/new` resolves to the same `/finance` entry. `core/guards/memberAccess.ts`'s `resolveMemberAccessDecision()` is the pure decision function consuming this map plus the member's coarse access state (`unauthenticated` / `no-workspace` / `inactive` / `active` with a permission list) — framework-agnostic and unit-tested in isolation, the same "pure decision function backing a thin framework wrapper" precedent as `lib/middleware/routeProtection.ts`'s own `resolveRouteProtectionDecision()`.

**Member session resolution** (`lib/auth/memberSessionSnapshot.ts`'s `resolveMemberSessionSnapshot()`) — resolved once per request in `(app)/layout.tsx` and wrapped in React's `cache()`, so a page's own route guard (`components/layout/RouteGuard.tsx`, applied via a per-module `layout.tsx` — e.g. `(app)/finance/layout.tsx` wraps every `/finance/*` route at once) reuses the same resolution instead of a second round trip. Branches on data mode exactly like every other dual-mode piece of this codebase: mock mode resolves through `TeamRepository`'s mock implementation (always the seeded owner, `member_1`, since mock mode has no real authentication); Supabase mode resolves through the extended `getWorkspaceSession()` (`lib/auth/workspaceSession.ts`), which now fetches the membership row regardless of status (previously filtered to `status = 'active'` only, which made an inactive membership indistinguishable from no membership at all) and resolves the member's `role_permissions` when active.

**Member session context** (`components/providers/MemberSessionProvider.tsx`) — a React Context seeded with the server-resolved snapshot, wrapping `AppShell` in `(app)/layout.tsx`. `useMemberSession()` exposes `user`/`profile`/`workspace`/`membership`/`role`/`permissions`/`isOwner`/`isAdmin`/`isManager`/`isStaff`/`can(permission)`/`workspaceDisplayName`/`loading` (always `false` in this MVP, since the snapshot is server-seeded before the client ever renders — no client-side fetch to wait on). `role`/`isOwner`/etc. are `null`/`false` whenever the member isn't active, even though `membership` itself (including the member's nominal role) stays populated for display purposes (see the Account page) — these convenience fields exist specifically to gate access, not to describe historical identity. Every page under `(app)` consumes this one context; none independently re-fetches the member's own session or permissions.

**Sidebar/MobileNav** (`config/navigation.ts`'s `getVisibleNavigationItems(can)`) filter the shared `navigationItems` list by the same route-access map (via `canAccessRoute()`) rather than a second nav-specific permission field — a module the member can't view via `*.view` simply isn't rendered. Since the snapshot is resolved server-side before the client shell ever paints, there is no flash of a link the member can't use and no client-side loading state for navigation visibility.

**Inactive-member and no-workspace handling** (`(app)/layout.tsx` + `components/layout/AccessBlockedPage.tsx`) — the shared layout inspects the resolved snapshot before rendering `AppShell` at all: `unauthenticated` redirects to `/sign-in` (defensive; middleware already covers this in `supabase` mode); `no-workspace` and `inactive` each render a bare, sidebar-less full-page state (mirroring `(auth)/layout.tsx`'s centered-card treatment, since there's no legitimate Workspace navigation to show) with a clear message and a working Sign Out button — never a redirect loop, never a flash of business data. An active member who simply lacks one route's specific permission sees `components/layout/ForbiddenState.tsx` instead, rendered *inside* the normal shell (sidebar intact), since they remain a legitimate Workspace member.

**Dashboard** (`modules/dashboard/components/DashboardMetrics.tsx`) — reuses the existing `getDashboardMetrics()` call unchanged (no duplicated Dashboard data logic) and filters the *rendered* cards by `canAccessRoute(metric.href, can)`, since every metric already links to the module it summarizes. This is a presentation-layer filter, not a data-layer access boundary — business-module RLS remains Workspace-isolation-only this phase (see `docs/permissions.md`), so the underlying figures already reach any Workspace member's authenticated session regardless of role; true request-level minimization for these retrofitted cards would require permission-aware business-module RLS, out of scope here. The one genuinely new card, Pending Team Invitations (`PendingInvitationsCard.tsx`), is written to the stricter standard from the start: it never calls `getWorkspaceInvitations()` at all unless the member holds `team.invite` (not merely `team.view` — the actual RLS `workspace_invitations` select policy is gated on `team.invite`, so a `team.view`-only member would see a misleading "0" if this card only checked `team.view`).

**Account page** (`/account`, `modules/account/components/AccountView.tsx`) — display name, email (initial avatar), role, membership status, Workspace name, and Sign Out, plus a link to the already-existing `/update-password` flow (the one profile action wired up this phase rather than built fresh, since `updatePassword()` already works for any authenticated session). Billing, MFA, notification preferences, and account deletion are explicitly out of scope.

**Action-level gating** — every create/edit/archive/lifecycle button across Leads/Clients/Events/Contracts/Finance(Invoices/Payments/Expenses)/Documents(+Folders) now checks the relevant permission via `useMemberSession().can(...)` before rendering: `*.create` gates "New X" buttons and duplicate-style actions; `*.update` gates Edit and in-place field editors; `*.archive` (or `contracts.lifecycle`, the one module with a dedicated lifecycle permission instead of a plain archive one) gates status-transition/archive/restore actions; `finance.refund` gates Payment's Refund action specifically, independent of `finance.update` — a member can hold either without the other. As stated in section 9 of this phase's own spec: **this UI gating is not a security boundary by itself** — it relies on, and never replaces, database/RLS enforcement, which for these business tables remains Workspace-isolation-only until a future phase extends RLS to be permission-aware.

## Client Accounts + Invitations foundation (live)

The authentication, account-linking, and invitation foundation for **external** Amoré Bloom clients — the second Phase 2 module, on `feature/client-access`. Deliberately separate from Team membership above: a client account is never a `workspace_members` row, an internal team member and a Client Portal user are distinguished by which linking table has a row for them (never by an email-domain assumption), and a client never gains internal Workspace access. Canonical model: Auth User → `client_accounts` row → exactly one `clients` record → permitted Events/Contracts/Invoices/Documents (live — see "Client Portal MVP" below). Explicitly out of scope this phase: Team Portal persona invitations, both Knowledge Bases, the Notification Center, and the Automation Center.

**Account statuses** (`core/enums/clientAccountStatus.ts`, `core/workflows/clientAccountWorkflow.ts`): `invited` (reserved/unused — the same precedent as `workspace_members.status`, a real row is only ever created directly as `active`), `active`, `suspended`, `revoked`. Unlike the Team foundation's membership model, `revoked` is not a hard terminal state — both `suspended` and `revoked` are reversible back to `active`, either via an internal team member's explicit `reactivateClientAccount` action or by the same person accepting a fresh invitation for the same Client (which reactivates their existing row in place rather than creating a duplicate).

**Invitation statuses** — reuses the exact same lifecycle and `core/workflows/invitationWorkflow.ts` as Team invitations (`pending → accepted/expired/revoked`), since the state machine is identical; only the linked entity differs (a Client, never a Workspace role). `client_invitations` is its own table, not a reuse of `workspace_invitations` — a Client invitation links to a `clients` row and never grants a `workspace_members` role.

**Token security** — identical convention to Team invitations (`lib/team/invitationToken.ts` reused unchanged: 256-bit random token, base64url-encoded, SHA-256 hash-only storage). The two Postgres RPCs (`get_client_invitation_by_token`/`accept_client_invitation`) use their own errcode range (`P0101`–`P0107`) distinct from Team's (`P0001`–`P0007`), so the two flows are never ambiguous to a caller inspecting a rejection code.

**Acceptance flow** (`/client-invitations/[token]`, `ClientInvitationAcceptanceView.tsx`) — mirrors `InvitationAcceptanceView.tsx` exactly in shape (token validation, sign-up/sign-in choice, atomic server-side acceptance re-validating the email match regardless of what the page displayed) with two differences: the preview shows the Client's own name (`client_name`, from `get_client_invitation_by_token`) instead of an invited role, and successful acceptance redirects to `/client-access` — never `/dashboard` or anywhere inside the internal Team Portal shell.

**Auth separation** — an authenticated user may hold a `workspace_members` row, a `client_accounts` row, both, or neither; which is which is decided purely by which linking table has a row for that `auth.uid()`, never by inspecting the user's email domain or any other heuristic. A client-only user hitting `/dashboard` (or any `(app)` route) sees the Team Portal's own `AccessBlockedPage` ("No Workspace access") — safe, not a crash, but a dead end by design, since a client account is never meant to reach the internal shell at all. The reverse is equally true: an internal team member with no `client_accounts` row hitting `/client-access` sees the Client Portal's own "No Client Portal access" blocked state. Neither user type ever triggers the original owner-Workspace-bootstrap path, and no code path auto-creates a `client_accounts` row outside `accept_client_invitation`.

**Client Portal session resolution** (`lib/auth/clientAccountSession.ts`'s `resolveClientAccountSessionSnapshot()`) — deliberately **not** a `cache()`-wrapped Server Component resolver like the Team Portal's `resolveMemberSessionSnapshot()`. `ClientAccessRepository`'s Supabase implementation uses the **browser** Supabase client throughout (the same convention every Supabase-backed repository in this codebase uses, since their UIs fetch from Client Components), so resolving a Client Portal session also happens client-side, inside `(client-portal)/layout.tsx` — the same established precedent as `InvitationAcceptanceView.tsx` checking `supabase.auth.getUser()` directly rather than through a Server Component. Mock mode skips the auth check entirely and always resolves through the seeded current client account, the same precedent as `getCurrentWorkspaceMember()`.

**Client Portal session context** (`components/providers/ClientAccountSessionProvider.tsx`) — seeded by `(client-portal)/layout.tsx` only once its own resolution has confirmed an active account; every consumer can assume a legitimate session, since unauthenticated/no-account/blocked states are all short-circuited before this provider ever mounts.

**Client Portal shell** (`components/layout/ClientPortalShell.tsx`) — deliberately not `AppShell`: no internal Sidebar, no Team navigation, no internal Dashboard. Branding reads "Amoré Bloom Client Portal" — never the bare Workspace name, and never the internal owner/non-owner "Amoré Bloom"/"Amoré Bloom Team" variants from the Team Portal above.

**Internal management UI** (`ClientAccessSection.tsx`, embedded on Client Detail, gated on `clients.portal_view` — hidden entirely without it, the same "hide the whole card" precedent as the Team Portal dashboard) — linked accounts with status/last-access, invite/resend/revoke actions on `client_invitations`, and suspend/reactivate/revoke actions on `client_accounts`, each gated by the specific granular permission (`clients.portal_invite`/`clients.portal_manage`/`clients.portal_suspend`) rather than a single blanket "manage" check. Never exposes a `token_hash`, and does not redesign Client Detail beyond this one new section.

**Invariants enforced below the application layer** — a partial unique index allows at most one `pending` invitation per Client/email at a time; a structural unique constraint (`workspace_id`, `client_id`, `auth_user_id`) prevents a duplicate `client_accounts` row for the same person/Client pair, so reactivation is always in-place, never a second row; `trg_validate_client_account_action_authority` enforces that a revoke or reactivate-from-revoked transition requires `clients.portal_manage` specifically, while a suspend/reactivate-from-suspended transition accepts either `clients.portal_suspend` or `clients.portal_manage` — deliberately bypassed via a transaction-local flag when `accept_client_invitation` itself performs the reactivation, since that caller is the client accepting their own invitation, not a permissioned team member.

## Client Portal MVP (live)

The real, business-data-facing external Client Portal — the third Phase 2 module, on `feature/client-access`, consuming the account/invitation foundation above unchanged. Explicitly out of scope this phase: Team Knowledge Base, Client Knowledge Base, Notification Center, Automation Center, payment-provider integration, client document upload, and e-signature infrastructure.

**Route model** — `/client-access` (Overview), `/client-access/events(/[id])`, `/client-access/contracts(/[id])`, `/client-access/invoices(/[id])`, `/client-access/documents(/[id])`, `/client-access/account`, all nested under the `(client-portal)` route group's own `client-access/` folder so every one of them inherits the shared `layout.tsx`'s auth-separation gating and falls under `PROTECTED_ROUTE_PREFIXES`'s `/client-access` prefix match — no sub-route lives at a bare top-level path outside `client-access/`.

**Client Portal shell nav** (`components/layout/ClientPortalShell.tsx`, extended this phase) — desktop horizontal nav (Overview/Events/Contracts/Invoices/Documents/Account) with active-route highlighting via `usePathname()` and a longest-prefix match, a mobile hamburger menu with the same items plus Sign Out, and "Client Portal" branding — still never `AppShell`, never an internal Sidebar or Team navigation link.

**Client Portal account context, extended** (`ClientAccountSessionProvider.tsx`) — widened from the foundation phase's narrow `{accountId, clientName, workspaceName, lastAccessAt}` shape to carry every raw id and field a page needs: `authUserId`, `accountId`, `clientId`, `workspaceId`, `email`, `clientName`, `workspaceName`, `accountStatus`, `acceptedAt`, `lastAccessAt`, `isActive`, `canAccessPortal`, and a new `logout()` method (`signOut()` then redirect to `/sign-in`) — one canonical context, no page independently re-fetches account state.

**Overview page** (`/client-access`, `ClientAccessLandingView.tsx`, rewritten from a static placeholder into the real Overview) — fetches `getClientPortalOverview()` and renders conditional cards (upcoming event, contracts-in-progress, next-payment-due-or-outstanding-balance, recent client-visible documents), each linking to its own Client Portal route, plus a "nothing to show yet" fallback when every card would be empty. Still touches `last_access_at` once per visit via `touch_client_account_last_access()`.

**My Events / My Contracts / My Invoices / My Documents / Account** — five new list+detail (or, for Account, single) view pairs (`src/modules/clientPortal/components/`), each backed by its own `getClientPortal*`/`getClientPortal*ById` repository call: safe fields only (see `docs/permissions.md`'s "Client Portal MVP (live)" section for the exact projection), reusing the existing `EventStatusBadge`/`ContractStatusBadge`/`SignatureStatusBadge`/`InvoiceStatusBadge`/`PaymentStatusBadge`/`DocumentCategoryBadge` components unchanged (the client-safe DTOs reuse the same enum types as their internal counterparts, so no new badge components were needed). A manipulated or inaccessible id in any detail route resolves to the same not-found state as a genuinely nonexistent one — RLS returns zero rows either way, and the repository surfaces both identically as `NotFoundError`. My Documents' download action calls `getClientPortalDocumentDownloadUrl()` and opens only the resulting signed URL — never a raw storage path.

**`ClientPortalRepository`** (`lib/data/clientPortal/`) — a new, bundled repository (mock + Supabase), wholly separate from every internal repository: never calls `requireWorkspaceSession()` (a client caller has none); mock mode filters the existing mock stores by the current mock client account's `client_id`; Supabase mode relies entirely on the new additive RLS policies (`docs/permissions.md`) as the real authorization boundary, with explicit column-list `select()` calls, never `select("*")`. See `docs/database.md`/`docs/permissions.md` for the RLS policies and RPC this repository consumes.

## Business rules

- An `events` record cannot exist without a `clients` record.
- A `contracts` record cannot move to `signed` without first being `sent` (and, once viewed, `viewed`) — enforced by `markSigned`'s own precondition, not just procedurally: it fails if the contract's `status` isn't `sent` or `viewed`.
- Applying a `payments` row to its `invoices` row is independent of the linked `contracts` row's status — this phase validates only Client/Event/Contract/Invoice workspace-and-ownership consistency, not Contract lifecycle state, before a Payment can succeed.
- A `contracts` record cannot exist without a `client_id`; `event_id` is optional, and when set must belong to that same client (data-layer validated).
- `contracts.contract_number` is generated uniquely per Workspace (`CT-{year}-{sequence}`) and checked for collisions on every create and duplicate — two Contracts can never share a number.
- Duplicating a Contract (`duplicateContract`) copies its content (client, event, template, value, deposit, dates, currency, notes) into a fresh `draft`/`unsigned` Contract with a new id and contract_number; it never copies status, signature_status, version history, or any lifecycle timestamp.
- Every Contract content edit (`updateContract`) increments `version` and appends the pre-edit state to `version_history` — the model's version history; there's no separate versions table and no editor UI yet.
- Restoring an archived Contract (`restoreContract`) always resumes at `draft`, the same "reasonable resumption point, not the exact pre-archive state" precedent as `restoreEvent` — a restored Contract goes through send/view/sign again for a clean audit trail.
- Contracts reuse the shared `notes`/`timeline_activities` architecture (`owner_type = 'contract'`) exactly like Events — there is no dedicated `ContractNote` type.
- A Client becomes `is_returning = true` the moment they have more than one `events` record.
- Declining at Proposal or cancelling a Contract ends that event's lifecycle but never deletes the Client relationship.
- A `leads` record's status transitions are governed by `core/workflows/leadWorkflow.ts` (the single source of truth, consumed by both the UI and the data layer): `converted` and `archived` are terminal, reachable only via their own dedicated action, never the plain status selector — see `BLOOMOS_BIBLE.md`'s Lead/Client definitions.
- Every Lead lifecycle event (created, edited, status change, note added, note pinned/unpinned, Welcome Guide sent, archived, converted) is recorded as a `timeline_activities` row (`owner_type = 'lead'`) through one shared mechanism — no module constructs a timeline entry by hand. The same mechanism and table serve Client lifecycle events (`owner_type = 'client'`): created, edited, tags changed, VIP status changed, communication preference changed, archived, restored; and Event lifecycle events (`owner_type = 'event'`): created, edited, status changed, lifecycle stage changed, priority changed, checklist item created/completed, default checklist applied, schedule item created/updated, archived, restored, cancelled, completed. The shared `togglePinNote()` dispatcher (`lib/data/index.ts`) tries the Leads repository, then Clients, then Events, before falling through to the generic mock-only path for every other not-yet-migrated owner type.
- Converting a Lead to a Client preserves that Lead's notes and timeline untouched (only one new `lead_converted` entry is appended to the Lead's timeline), retains the original Lead record read-only, records a `client_created` entry on the new Client's own timeline, and cannot happen twice for the same Lead. In mock mode this is `LeadConversionService.convertLeadToClient` (unchanged, still mock-only). In `supabase` mode it's the atomic `convert_lead_to_client` Postgres function (`docs/database.md`), which additionally **rejects an archived Lead** — archived is a terminal state in both modes, and conversion is not a way around it.
- An `events` record cannot exist without a `client_id`; `originating_lead_id` is optional and never required for a manually created Event.
- Creating an Event auto-populates its `checklist_items` from a default template keyed by `event_type` (`modules/events/constants/checklistTemplates.ts`) when one exists for that type (proposal, picnic, hotel_decoration, and anniversary have one today); the user edits or removes items from there. No UI ever constructs a checklist item by hand for this purpose — `createEvent()` is the only caller. Template application is one atomic batch operation: every item is validated (TypeScript, before anything is written) regardless of data mode. In mock mode this is the internal `applyDefaultChecklistTemplate` (`lib/data/events/mockRepository.ts`, not exported for UI use); in `supabase` mode it's the `apply_default_event_checklist` Postgres function (`docs/database.md`), called via `supabase.rpc(...)` — either way, the whole set is written as a single atomic unit and exactly one summarized `checklist_template_applied` timeline entry is recorded (e.g. "Default Proposal checklist created with 11 items.") instead of one `checklist_item_created` entry per item — a failed validation leaves the Event with no checklist items at all rather than a partial set. Manually created checklist items (`createChecklistItem`) are unaffected and still record their own individual `checklist_item_created` entry.
- A `checklist_items` row cannot be deleted once its status is `completed` — it's part of the Event's completed history, not a mistake to undo. It can still be un-completed via `updateChecklistItemStatus` and deleted afterward.
- `checklist_items.assigned_type`/`assigned_id`/`assigned_name` and `schedule_items`'s `owner_type`/`owner_id` are prepared generalizations with no corresponding UI or Employee/Vendor data yet — see `docs/database.md`'s "Polymorphic ownership" section.
- An `invoices` record cannot exist without a `client_id`; `event_id`/`contract_id` are optional, and when set must belong to that same client (data-layer validated) — mirrors the Contract rule exactly.
- `invoices.invoice_number` is generated uniquely per Workspace (`INV-{year}-{sequence}`) and checked for collisions on every create and duplicate, the same mechanism as `contracts.contract_number`.
- `invoices.total_minor` is always derived (`subtotal_minor + tax_minor - discount_minor`); `paid_minor`/`balance_minor` are always derived from every currently-counting linked Payment, net of refunds — none of the three is ever written directly by a caller.
- A `payments` row may exist without an `invoices` row, but always requires a `client_id` and `workspace_id`; when `invoice_id` is set, that Invoice's `client_id`/`workspace_id` must match the Payment's (data-layer validated).
- Only a `succeeded`, `partially_refunded`, or `refunded` Payment counts toward its Invoice's paid total — `pending`/`processing`/`failed`/`cancelled` never do.
- A refund can never exceed the refundable amount remaining on its original Payment (that Payment's `amount_minor` minus every prior refund already issued against it) — `refundPayment` fails outright rather than allow an over-refund.
- Duplicating an Invoice (`duplicateInvoice`) or Expense (`duplicateExpense`) copies content only into a fresh starting-status record with a new id (and, for Invoice, a new invoice_number); neither ever copies status, paid/reimbursed state, or any lifecycle timestamp — the same precedent as `duplicateContract`.
- Restoring an archived Invoice or Expense (`restoreInvoice`/`restoreExpense`) always resumes at `draft`/`planned` respectively — the same "reasonable resumption point" precedent as `restoreContract`/`restoreEvent`.
- An `expenses` row cannot exist without a `workspace_id`, but `event_id`/`client_id` are both optional (a general business expense has neither) — unlike every other entity in this data layer, `workspace_id` is assigned directly rather than derived from a required Client.
- `expenses.reimbursable` (whether an Expense is eligible for reimbursement) and `status: "reimbursed"` (whether that reimbursement has actually happened) are independent — `markExpenseReimbursed` fails on a non-reimbursable Expense regardless of its status.
- Invoices/Payments/Expenses each reuse the shared `notes`/`timeline_activities` architecture (`owner_type = 'invoice' | 'payment' | 'expense'`) exactly like Contracts — there is no dedicated InvoiceNote/PaymentNote/ExpenseNote type.
- A `documents` row cannot exist without a `workspace_id`; `owner_type` is validated against the practical set (`workspace`, `client`, `event`, `contract`, `invoice`, `payment`, `expense`) and `owner_id` must reference a real row of that type — data-layer validated, same as every other polymorphic owner in this app.
- When a Document's typed reference fields (`client_id`, `event_id`, `contract_id`) are set together, they must agree with each other exactly like Invoice/Expense's event/contract-vs-client checks (e.g. an `event_id` reference must belong to the given `client_id` reference) — this is independent of and in addition to the `owner_type`/`owner_id` check above.
- A Document's `folder_id`, when set, must reference a `document_folders` row with the same `owner_type`/`owner_id` as the Document itself — a Document can never be filed into a folder belonging to a different owner.
- `createDocumentVersion` inherits `category` from the version it supersedes and refuses to change it — a version chain's category is fixed by its first version; `title`/`visibility`/`expires_at` may still be overridden per version.
- Documents/Document Folders each reuse the shared `notes`/`timeline_activities` architecture (`owner_type = 'document' | 'document_folder'`) exactly like Contracts/Invoices/Payments/Expenses — there is no dedicated DocumentNote/FolderNote type.
- The placeholder attachment helpers (`attachDocumentToContractExhibit`, `attachDocumentToPayment`, `attachDocumentToExpense`, `attachDocumentToInvoice`, `attachDocumentToEvent`, `attachDocumentToClient`) update only the Document's own typed reference field; they never rewrite `contract_exhibits.document_id`/`payments.document_id`/`expenses.document_id` automatically — additive and backward-compatible with the Contracts/Finance foundations those columns were introduced in.
- A `workspace_invitations` row cannot exist without a `workspace_id`; at most one `pending` invitation may exist per Workspace/email pair at a time — creating a second one for the same email while the first is still `pending` fails outright rather than silently superseding it (use `resendWorkspaceInvitation` instead).
- Only an `owner` may invite or promote someone to `owner` or `admin`; an `admin` may invite or promote only to `manager`/`staff`; a `manager`/`staff` cannot invite or manage roles at all (`team.invite`/`team.manage_roles` permissions) — enforced at the RLS/trigger level, not just hidden in the UI.
- A Workspace's last remaining `owner` can never be removed, demoted, or suspended via `updateWorkspaceMemberRole`/`deactivateWorkspaceMember`/`removeWorkspaceMember` — every one of those actions fails outright against the sole remaining owner, the same "fail outright rather than allow an invalid state" precedent as an over-refund on a Payment.
- Owner-only branding (`getWorkspaceDisplayName()`, `lib/workspaceDisplayName.ts`): only a member whose `role` is exactly `owner` sees the bare Workspace name ("Amoré Bloom"); every other role, including `admin`, sees the Workspace name suffixed with "Team" ("Amoré Bloom Team") — a narrower rule than the Foundation phase's original owner-or-admin check.
