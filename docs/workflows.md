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
- Every Lead lifecycle event (created, edited, status change, note added, note pinned/unpinned, Welcome Guide sent, archived, converted) is recorded as a `timeline_activities` row (`owner_type = 'lead'`) through one shared mechanism — no module constructs a timeline entry by hand. The same mechanism and table serve Client lifecycle events (`owner_type = 'client'`): created, edited, tags changed, VIP status changed, communication preference changed, archived, restored.
- Converting a Lead to a Client preserves that Lead's notes and timeline untouched (only one new `lead_converted` entry is appended to the Lead's timeline), retains the original Lead record read-only, records a `client_created` entry on the new Client's own timeline, and cannot happen twice for the same Lead.
- An `events` record cannot exist without a `client_id`; `originating_lead_id` is optional and never required for a manually created Event.
- Creating an Event auto-populates its `checklist_items` from a default template keyed by `event_type` (`modules/events/constants/checklistTemplates.ts`) when one exists for that type (proposal, picnic, hotel_decoration, and anniversary have one today); the user edits or removes items from there. No UI ever constructs a checklist item by hand for this purpose — `createEvent()` is the only caller. Template application is one atomic batch operation (internal `applyDefaultChecklistTemplate`, not exported for UI use): every item is validated before anything is written, the whole set is written in a single batch, and exactly one summarized `checklist_template_applied` timeline entry is recorded (e.g. "Default Proposal checklist created with 11 items.") instead of one `checklist_item_created` entry per item — a failed validation leaves the Event with no checklist items at all rather than a partial set. Manually created checklist items (`createChecklistItem`) are unaffected and still record their own individual `checklist_item_created` entry.
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
