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

As implemented (`core/workflows/contractWorkflow.ts`), a Contract tracks **two independent state machines**, the same pattern as an Event's `status`/`lifecycle_stage`:

- **`status`** — the contract's overall commercial lifecycle: `draft`, `review`, `ready`, `sent`, `viewed`, `signed`, `completed`, `expired`, `cancelled`, `archived`, `declined`. `draft`/`review`/`ready` remain freely inter-transitionable through the plain status setter (`updateContractStatus`); every other value is reachable only through its own dedicated data-layer action (`sendContract`, `markViewed`, `markSigned`, `completeContract`, `expireContract`, `cancelContract`, `archiveContract`, `markDeclined`) and never left again except by a further dedicated action.
- **`signature_status`** — specifically the e-signature process: `unsigned`, `sent`, `viewed`, `partially_signed`, `signed`, `declined`, `expired`, `cancelled`. Moves in lockstep with `status` through the dedicated actions above, except it can additionally reach `partially_signed` — a state `status` has no equivalent for, reserved for a future multi-signer scenario no action currently sets.

Neither is inferred from the other. `isContractClosed()` identifies the narrower set of statuses with genuinely nothing left to do (`completed`, `expired`, `cancelled`, `archived`, `declined`) — distinct from "locked" (entry-restricted to a dedicated action), since a `sent`/`viewed`/`signed` contract is locked from the plain setter but still very much mid-flow. `getContractNextRecommendedAction()` (mirroring `getEventNextRecommendedAction`/`getNextRecommendedAction`) returns a deterministic suggestion for every non-closed status, including flagging a `sent` contract that has passed its `expiration_date`.

A Contract always belongs to a Client (`client_id` required); `event_id` is deliberately optional, so a Contract can stand on its own (e.g. a retainer) ahead of or without a dedicated Event record — never assume the Lead → Client → Event → Contract chain is fully populated. If `event_id` is set, it must belong to the same `client_id` (data-layer validated on both create and update).

## Finance

Continues the cycle Contract closes: Lead → Client → Event → Contract → Invoice → Payments → Expenses → Profit. Three independent models, each with its own state machine (`core/workflows/invoiceWorkflow.ts` / `paymentWorkflow.ts` / `expenseWorkflow.ts`):

- **Invoice** (`draft`, `issued`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `voided`, `archived`) — unlike Contract/Event, there is **no plain status setter**. Every non-`draft` value is reached only through its own dedicated data-layer action (`issueInvoice`, `sendInvoice`, `markInvoiceViewed`, `markInvoiceOverdue`, `voidInvoice`, `archiveInvoice`, `restoreInvoice`) or automatically when a successful Payment is applied (`partially_paid`/`paid`, computed fresh from every linked Payment each time one changes — see `applyPaymentToInvoice` in `lib/data/index.ts`). `client_id` is required; `event_id`/`contract_id` are optional but must belong to the same client when set.
- **Payment** (`pending`, `processing`, `succeeded`, `failed`, `partially_refunded`, `refunded`, `cancelled`) — `succeeded` is deliberately not terminal (it can still move to `partially_refunded`/`refunded`, the same way a signed Contract can still be cancelled). Only `succeeded`/`partially_refunded`/`refunded` count toward an Invoice's paid total. `invoice_id` is optional (a Payment may exist standalone), but `client_id`/`workspace_id` are always required and validated for consistency against any linked Invoice/Event/Contract.
- **Expense** (`planned`, `approved`, `due`, `paid`, `reimbursed`, `cancelled`, `archived`) — every non-`planned` value is reached only through its own dedicated action (`approveExpense`, `markExpenseDue`, `markExpensePaid`, `markExpenseReimbursed`, `cancelExpense`, `archiveExpense`, `restoreExpense`). `event_id`/`client_id` are both optional (a general business expense has neither); `supplier_id`/`team_member_id` are unvalidated forward-looking placeholders.

Money is always an integer minor-unit amount (`lib/money.ts`) — see `docs/database.md`'s "Money model" section. Refunds are a Payment with `payment_type: "refund"`, not a second ledger — see `docs/database.md`'s "Refund model" section for the exact mechanics. `modules/finance/eventFinancialStatus.ts`'s `EventFinancialStatus` is derived on every read from an Event's Contracts/Invoices/Payments, never persisted — see `docs/database.md`'s "Derived Event financial status" section.

## Documents

The single shared file system every other module attaches files through — see `docs/database.md`'s `documents`/`document_folders` sections for the full column reference. Two independent state machines, neither inferred from the other:

- **Document** (`core/workflows/documentWorkflow.ts`) — `draft`, `active`, `superseded`, `expired`, `archived`, `deleted`. Every non-`draft` value is reached only through its own dedicated action (`activateDocument`, `createDocumentVersion` marks the prior latest version `superseded`, `expireDocument`, `archiveDocument`, `softDeleteDocument`). Only `deleted` is terminal (`isDocumentTerminal`); `archived`/`deleted` both restore to `active` via `restoreDocument` — the same "reasonable resumption point" precedent as `restoreContract`/`restoreExpense`. `getDocumentNextRecommendedAction()` returns a deterministic suggestion for every status, including flagging incomplete metadata on a draft (uncategorized or unfiled) and an active Document expiring within 14 days.
- **Document Folder** — no status enum; archiving is `archived_at`-based only (`archiveDocumentFolder`/`restoreDocumentFolder`) and does not cascade to child folders or the Documents inside. Folder-tree rules (nesting, cycle prevention, cross-Workspace/cross-owner move guards) are centralized in `core/workflows/documentFolderWorkflow.ts` and never reimplemented by a caller.

No money model applies here (Documents carry no monetary fields). No real file storage, upload, download, OCR, e-signature, or PDF generation exists in this phase — every mock Document's `storage_provider` is `"mock"`; see `docs/integrations.md`.

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

Active only when `NEXT_PUBLIC_DATA_MODE=supabase`; in `mock` mode (the default) none of this runs. Leads, Clients, and Events are the first three business modules wired to live Supabase (`docs/integrations.md`), including Lead → Client conversion (`convert_lead_to_client`) and atomic default-checklist application (`apply_default_event_checklist`, see `docs/database.md`); every other business module (Contracts, Finance, Documents) still runs on the mock data layer regardless of this setting.

- **Sign in** (`signInWithPassword`, `lib/auth/actions.ts`) — email/password only. On success, redirects to the `redirectTo` query param if it's a same-origin path (`safeRedirectTarget` rejects anything not starting with `/`, and rejects `//` to block protocol-relative external redirects), otherwise `/dashboard`.
- **Route protection** (`src/middleware.ts` + pure `lib/middleware/routeProtection.ts`) — on every request to a protected route prefix (`/dashboard`, `/leads`, `/clients`, `/events`, `/contracts`, `/finance`, `/documents`) without a session, redirects to `/sign-in?redirectTo=<original path>`, preserving the intended destination for sign-in to return to. Auth routes themselves (`/sign-in`, `/reset-password`, `/update-password`, `/auth/callback`) are always allowed regardless of session state, which is what prevents a redirect loop.
- **Session refresh** (`lib/supabase/middleware.ts`) — runs on every matched request when in `supabase` mode, refreshing the Supabase session cookie before the route-protection decision is made.
- **Sign out** (`signOut`) — clears the session, redirects to `/sign-in`.
- **Password reset** is two steps, both Server Actions: `requestPasswordReset` emails a link that lands on `/auth/callback?next=/update-password` (the callback route exchanges the code for a session), then `updatePassword` sets the new password and redirects to `/sign-in`.
- **`getCurrentUser()`** (`lib/auth/session.ts`) is the preferred read for any auth-gating decision — it revalidates the token against Supabase Auth rather than trusting the (spoofable) session cookie the way `getSession()` does.
- Every Supabase Auth/Postgres error surfaced by any of the above is passed through `normalizeSupabaseError` (`lib/supabase/errors.ts`) first — a raw database/auth error message never reaches a form's error state.

## Invitation lifecycle (architecture, planned — not implemented)

Ahead of Client Portal/Team Portal implementation — see `docs/permissions.md`'s "Client and Team Portal invitations" section for the full flow, the "never generate/email/store a password" rule, and the server-only `service_role` exception. Nothing below exists in code yet; no `core/workflows/invitationWorkflow.ts` file exists.

Canonical statuses: `invited`, `sent`, `accepted`, `expired`, `revoked`. Intended transition rules, mirroring the terminal-status pattern already used by `core/workflows/leadWorkflow.ts` and every other module's workflow file:

| From | Legal next states |
|---|---|
| `invited` | `sent` (link dispatched) |
| `sent` | `accepted` (recipient completes activation), `expired` (time limit passed unaccepted), `revoked` (administrator cancels), `sent` again (resend, extends/resets expiration) |
| `accepted` | *(terminal — the invitation's job is done; the resulting membership's own `status` — `active`/`suspended` — governs access from here, not the invitation)* |
| `expired` | *(terminal — a new invitation must be created; an expired one is never silently reactivated)* |
| `revoked` | *(terminal — same as `expired`)* |

Every transition is expected to record a Timeline entry via the existing `recordTimelineActivity` mechanism, exactly like every other module's lifecycle — never constructed by hand, never skipped.

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
