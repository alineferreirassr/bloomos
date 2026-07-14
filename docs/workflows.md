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

The MVP tracks `lifecycle_stage` on the `events` table (see `docs/database.md`) through: `lead`, `consultation`, `proposal`, `contract`, `deposit`, `planning`, `execution`, `gallery`, `feedback`, `completed`. Inventory and Team are tracked as future sub-stages/modules, not separate `lifecycle_stage` values, since they run in parallel with Planning rather than sequentially.

## Business rules

- An `events` record cannot exist without a `clients` record.
- A `contracts` record cannot move to `signed` without an approved Proposal having occurred (enforced procedurally in the MVP; formal state-machine enforcement can be added later).
- A `payments` row of type `deposit` cannot be `paid` before its `contracts` row is `signed`.
- A Client becomes `is_returning = true` the moment they have more than one `events` record.
- Declining at Proposal or cancelling a Contract ends that event's lifecycle but never deletes the Client relationship.
- A `leads` record's status transitions are governed by `core/workflows/leadWorkflow.ts` (the single source of truth, consumed by both the UI and the data layer): `converted` and `archived` are terminal, reachable only via their own dedicated action, never the plain status selector — see `BLOOMOS_BIBLE.md`'s Lead/Client definitions.
- Every Lead lifecycle event (created, edited, status change, note added, note pinned/unpinned, Welcome Guide sent, archived, converted) is recorded as a `timeline_activities` row (`owner_type = 'lead'`) through one shared mechanism — no module constructs a timeline entry by hand. The same mechanism and table serve Client lifecycle events (`owner_type = 'client'`): created, edited, tags changed, VIP status changed, communication preference changed, archived, restored.
- Converting a Lead to a Client preserves that Lead's notes and timeline untouched (only one new `lead_converted` entry is appended to the Lead's timeline), retains the original Lead record read-only, records a `client_created` entry on the new Client's own timeline, and cannot happen twice for the same Lead.
