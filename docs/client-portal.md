# Client Portal

The Client Portal is a secure, external-facing workspace where a BloomOS client can view, review, approve, download, upload (placeholder), track, and communicate — without ever exposing internal BloomOS functionality. It is **not** a second CRM: every screen is a thin, client-safe read (or a narrowly-scoped write, like completing a checklist item) over data that already exists in the real BloomOS modules. No business logic is duplicated.

```
Client Portal UI → Portal Services (src/lib/data/clientPortal/, src/modules/clientPortal/)
                 → Existing BloomOS APIs (src/lib/data, core/*)
                 → CRM / Finance / Documents / Notifications / Workflow / AI
```

This document covers the whole Client Portal as it exists today: the original MVP (Overview, Events, Contracts, Invoices, Documents, Account — see `docs/permissions.md`'s "Client Portal MVP (live)" for the original RLS/security write-up) and Checkpoint 14's additions (Timeline, Checklist, Messages, Notifications, Document Approval, Receipts, Dashboard extras, Workflow triggers, read-only AI summaries). See [docs/v2-checkpoint-14-client-portal.md](v2-checkpoint-14-client-portal.md) for the certification report specific to that delta.

## Authentication and lifecycle

Unchanged from the MVP, summarized here for completeness — full detail in `docs/permissions.md`'s "Client accounts and invitations" section:

- **Invitation-only.** BloomOS never generates, emails, or displays a temporary password. A staff member with `clients.portal_invite` sends a single-use invitation link (`client_invitations`); the recipient sets their own password via the ordinary `signUpWithPassword` flow.
- **Canonical model:** Auth User → `client_accounts` row → exactly one `clients` record → permitted Events/Contracts/Invoices/Documents. A client account is never a `workspace_members` row and never receives a `role_permissions` grant.
- **Session:** `ClientAccountSessionProvider` (`components/providers/ClientAccountSessionProvider.tsx`) is the one canonical context every Client Portal page reads from — `authUserId`/`accountId`/`clientId`/`workspaceId`/`email`/`clientName`/`workspaceName`/`accountStatus`/`acceptedAt`/`lastAccessAt`/`isActive`/`canAccessPortal`/`logout`. No page independently re-fetches account context.
- **Session expiration / forgot password / email verification** reuse the same Supabase Auth primitives every other BloomOS auth flow uses — no second, parallel auth system.
- **Blocked states:** `unauthenticated`/`no-account`/`blocked`/`error` all render `AccessBlockedPage` with a `Client Portal` brand suffix, never a crash and never a silent redirect into the internal Team Portal shell.

## Security model

Two calling conventions coexist deliberately:

1. **The browser-safe data facade** (`src/lib/data/index.ts` and its `clientPortal`/`clientAccess` sub-repositories) — no `"use server"` directive, callable directly from Client Components. In Supabase mode this is safe because every repository call uses the **browser** Supabase client and **RLS is the real security boundary**, not the call site. Most Client Portal reads and writes go through this path (`getClientPortalOverview`, `getClientPortalDocuments`, `completeClientPortalChecklistItem`, `sendClientPortalMessageAsClient`, etc.).
2. **Genuine `"use server"` Server Actions**, used only when server-only code must be reached — e.g. `getClientPortalReceiptAction.ts` (reaches `getDocumentsManager()`, which transitively imports `server-only`-guarded AI/Automation code) and `dispatchClientPortalTriggerActions.ts` (reaches the Automation Engine's dispatch/registration pipeline). These take `workspaceId`/`clientId` as plain arguments — sourced client-side from `useClientAccountSession()` — because the session resolvers these Server Actions could otherwise call are themselves browser-only. `getClientPortalReceiptAction.ts` independently re-verifies the target Invoice's own `workspace_id`/`client_id` before returning anything; the Workflow Trigger dispatch actions accept the caller's session ids as given and rely on the fact that (a) the real mutation they report on has already succeeded through the RLS-protected facade, and (b) nothing is currently registered to *execute* on any of these triggers — see Known limitations.

**Never trust a client-supplied id as authorization** — every read scoped to "my documents"/"my invoices"/"my checklist" is filtered server-side (RLS in Supabase mode, an explicit ownership check in mock mode), never by a client-supplied `client_id` alone.

## Permission model (what the Portal can never touch)

Per the checkpoint's own explicit boundary, the Client Portal never accesses:

- **Internal notes** (`notes` table) — no client-facing policy, no client-facing UI.
- **AI Memory** — the Portal surfaces only already-generated content (a Proposal's own `executive_summary`), never the Memory Store, never a Memory browsing UI.
- **CRM internals** — Leads, internal Activity feed, internal Client fields (`expenses` has a `client_id` column and is explicitly excluded from any client-facing policy).
- **Finance internals** — Expenses, the General Ledger, Journal Entries, Accounting Periods, Financial Reports. The Portal only ever reads its own Invoices/Payments/Receipts.
- **Automation / Workflow Builder internals** — the Portal can *fire* a Workflow Trigger event (Step 10, below) but can never read an Automation's name, conditions, or action list, and never lists, edits, or publishes a Workflow. The Timeline's own "Workflow Update" entries read only `AutomationExecution.actionResults[].message` — never the Automation's own configuration.
- **Admin Settings** — no Settings page, no Settings read of any kind.

## Feature walkthrough

### Dashboard (`/client-access`)

`ClientAccessLandingView.tsx` renders `getClientPortalOverview()`'s primary cards (Upcoming Event, Contracts in progress, Next Payment Due / Outstanding Balance, Recent Documents) plus, once loaded:

- **Highlights** — a deterministic, computed summary (days-until-event, payment-due-in-N-days, recent-document count) derived entirely from data the Overview already fetched. Never a new AI call, never labeled as AI-generated.
- **`ClientAccessDashboardExtras`** — Pending Approvals (documents awaiting the client's own decision), Unread Messages, a Timeline entry point, Recent Activity (the client's own last few actions), and the read-only Proposal Summary card.

### Documents (`/client-access/documents`)

View, download, and — new this checkpoint — **Approve (placeholder)** / **Reject (placeholder)**. `ClientDocumentApproval` is a wholly separate record from the Document Platform's own `ComposedDocument` lifecycle (draft/published/archived) — a client's sentiment is a different axis and never mutates the underlying Document. A client can never edit a Document.

### Finance (`/client-access/invoices`)

Invoices, Payment History, Outstanding Balance, and an **Upcoming Payments** section (invoices with a positive balance, soonest due date first). **Receipts** are surfaced by reading an already-compiled `ComposedDocument` of type `receipt` whose `mergeContext.invoiceId` matches — never compiled on demand, since a client has no reason to hold `documents.create`. No payment processing of any kind.

### Timeline (`/client-access/timeline`)

`aggregateClientPortalTimeline()` is a pure read-aggregation over Proposal-accepted, Contract-generated, Invoice-issued, Payment-received, Document-published, and Workflow-milestone events — no new schema, since it only reads pre-existing timestamped columns already covered by RLS.

### Checklist (`/client-access/checklist`)

Only checklist items a staff member has explicitly marked `client_visible` ever appear. A client may **Complete** or **Comment** — never edit an item's own title/description. **Upload attachment** is an inert, explicitly-disabled placeholder per this checkpoint's own scope.

### Messages (`/client-access/messages`)

A single conversation between the client and the Workspace (one thread per Client Account, no thread list this phase). No realtime — the page loads once with an explicit Refresh button, never a websocket or polling loop. **Attachments** and a **typing indicator** are both inert, explicitly-disabled placeholders.

### Notifications (`/client-access/notifications`)

Reuses the real, shared `core/notifications` module directly — `Notification.recipient_client_account_id` (added this checkpoint, additive and backward-compatible with every existing member-only caller) is the only thing that makes a client account a valid recipient. No parallel notification system.

### Workflow Integration (publish-only, never execute)

Three new `AutomationTriggerType` values — `checklist_item.completed`, `document.downloaded`, `proposal.viewed` — are dispatched through the exact same channel `proposal.accepted`/`proposal.rejected` already use (`dispatchAutomationTrigger`, `src/core/automation/resolver.ts`), from three thin Server Actions in `src/modules/clientPortal/dispatchClientPortalTriggerActions.ts`. Each is called only *after* the real mutation it reports on has already succeeded. A Workflow only ever runs from one of these triggers if a staff member has already designed and **published** it as a real Automation via the Workflow Builder — the Portal itself never creates, edits, publishes, or executes anything. Each trigger also has a matching Workflow Builder Trigger node (`src/modules/workflow/nodes/triggerNodes.ts`) so a staff member can actually build a Workflow around it.

### AI Integration (read-only, no Ask Bloom)

- **Proposal Summary** — the client's own accepted Proposal's pre-existing, AI-authored `executive_summary` field (`getClientPortalProposalSummary()`). Never triggers a new generation.
- **Daily Highlights** — see Dashboard above; entirely deterministic, not AI at all, and deliberately not presented as AI-generated.

Ask Bloom, the CRM/Finance Assistants, and every internal Skill remain completely unreachable from the Client Portal.

## Observability

`ClientPortalActivityKind` (`src/types/clientPortalActivity.ts`) is a closed set: `login`, `document_viewed`, `document_downloaded`, `invoice_viewed`, `timeline_viewed`, `notification_read`, `checklist_item_completed`, `message_sent`. Every kind has a real call site (`logClientPortalActivityForCurrentSession`), logged from the page/action where it actually happens, never batched or inferred. Only client-safe `entityId`/`entityLabel` are ever stored — never raw message bodies or comment text, matching `core/observability/logger`'s own "never log content" discipline.

## Accessibility

Keyboard: every interactive control is a real `<button>`/`<a>`/form element — no click-handler-only `<div>`s. Loading states use `aria-live="polite"`/`aria-busy="true"` wrapping the loading `Skeleton`, matching the convention already used elsewhere in the app (`VendorTimelineSection.tsx`, `Toast.tsx`). Dynamic counts (Pending Approvals, Unread Messages) and status changes (Document approval Badge) are wrapped in `aria-live="polite"` regions. Color is never the sole signal — every status `Badge` pairs a tone with a text label. Dark mode: BloomOS is a single-theme (light) product today — `globals.css` defines no `prefers-color-scheme`/theme rules at all, confirmed live (the browser's own `prefers-color-scheme: dark` reports `true` but the rendered background never changes). "Dark mode" readiness for this checkpoint means every new surface uses the app's semantic CSS-variable classes (`text-text`, `text-text-muted`, `bg-surface` via `Card`, `border-border`, `text-danger`) instead of hardcoded Tailwind color literals — a real dark theme, if ever added, only has to redefine those tokens once rather than hunt down literals across every new component. One pre-existing bug fixed this pass: two error messages in `ClientPortalDocumentDetailView.tsx` used a hardcoded `text-rose-700 dark:text-rose-300` pair that would have rendered light-pink-on-light-card and been nearly illegible the moment a real dark theme ships; both now use the shared `text-danger` token.

## Future realtime support

Messages and Notifications are both designed so a future realtime layer (Supabase Realtime subscriptions, most likely) can be added without a data-model change: `ClientPortalMessageThread`/`ClientPortalMessage` already carry `unread_count`/`read_at` fields a live subscription would simply push updates into, and the Notification Center already reuses the shared, already-realtime-capable-elsewhere `core/notifications` module. No polling loop or websocket exists today — every page is an explicit load-once-plus-manual-refresh, by design, per this checkpoint's own non-goal.

## Known limitations

- **Workflow Trigger dispatch trusts the caller's own session-sourced `workspaceId`/`clientId`** without an independent re-fetch-and-compare (unlike `getClientPortalReceiptAction.ts`, which does re-verify). The practical risk is low today — no Automation is registered against any of the three new triggers yet, so a spoofed dispatch is inert — but this is a real gap if a future Automation is registered against one of them; the fix would follow the Receipt action's own precedent (re-fetch the target entity, compare `workspace_id`/`client_id`).
- **"Mark Complete" / "Mark Read" controls disappear from the DOM once their state flips**, dropping keyboard focus to `<body>` rather than to a stable nearby element. Functional, not a hard accessibility failure, but worth a follow-up focus-management pass.
- **Checklist/Message/Reject-comment inputs are hand-rolled `<input>`/`<textarea>` elements** rather than the shared `Input`/`Textarea` primitives — consistent styling today, but any future shared focus-style improvement won't automatically reach them.
- **New Checkpoint 14 domains (Activity log, Messages, Document Approval, client-visible Checklist columns) are mock-only regardless of `NEXT_PUBLIC_DATA_MODE`.** A real migration exists (`supabase/migrations/20260807110000_client_portal_checkpoint14.sql`) but has not been applied to the linked remote project — applying it and flipping these domains to genuinely dual-mode is a deliberate, explicit next step, not an oversight.
