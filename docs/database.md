# Database

This document defines the data model for BloomOS. It is a design reference, written ahead of any live Supabase connection — no schema here has been applied to a real database yet. Terminology follows `BLOOMOS_BIBLE.md`; if they ever disagree, the Bible wins and this file gets corrected.

## Principles

- **Multi-tenant-ready, not multi-tenant-active.** Every core table carries a `workspace_id` column from day one, even though the MVP runs a single tenant (Amoré Bloom). This avoids a painful retrofit later. See `BLOOMOS_BIBLE.md` §7 for what a Workspace is.
- **UUID primary keys** everywhere, generated server-side.
- **Timestamps on everything:** `created_at`, `updated_at` (and `deleted_at` for soft deletes where reversibility matters — e.g. Clients, Events, Contracts).
- **Status/stage as constrained enums**, not free text, so the lifecycle in `docs/workflows.md` is enforced at the data layer.
- **No business data lives only in the frontend.** Mock data during MVP development mirrors this schema exactly, so swapping in Supabase later is a data-source change, not a rewrite.

## MVP entities

### `workspaces`
The schema representation of a Workspace (`BLOOMOS_BIBLE.md` §7) — one row per business operating on BloomOS. Reserved for multi-tenancy readiness. In the MVP, exactly one row exists (Amoré Bloom).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | |
| created_at | timestamptz | |

### `leads`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | nullable |
| instagram | text | nullable |
| source | text | how they found the business — curated options in `modules/leads/constants.ts`, not a canonical enum |
| event_type | text | nullable — curated options in `modules/leads/constants.ts` |
| event_date | date | nullable |
| location | text | nullable |
| budget_min | numeric | nullable |
| budget_max | numeric | nullable |
| message | text | nullable |
| status | enum | `new`, `contacted`, `welcome_guide_sent`, `consultation_scheduled`, `qualified`, `proposal_sent`, `converted`, `lost`, `archived` — canonical values and transition rules live in `core/workflows/leadWorkflow.ts`, not duplicated here |
| assigned_to | text | nullable — team member name; becomes a real FK once a Team module and auth exist |
| converted_client_id | uuid | nullable FK → clients, set on conversion |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable, set when status becomes `archived` |

### `notes`
Shared by Leads and Clients — one polymorphic table (`owner_type` + `owner_id`) rather than a separate `lead_notes` and `client_notes` table, so the shape doesn't duplicate itself as more owner types are added.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — see "Polymorphic ownership" below for why every read/write scopes by this in addition to owner_type/owner_id |
| owner_type | enum | `lead`, `client`, `event`, `contract` |
| owner_id | uuid | references leads.id, clients.id, events.id, or contracts.id, depending on owner_type — **not** a database-enforced FK; see below |
| title | text | |
| content | text | |
| category | enum | `general`, `special_request`, `preference`, `relationship_detail`, `allergy`, `accessibility`, `dietary_restriction`, `communication`, `internal_alert`, `idea`, `reminder`, `problem` |
| priority | enum | `low`, `normal`, `high`, `critical` |
| is_pinned | boolean | pinned notes surface first on the Lead/Client detail page |
| attachments | jsonb | metadata-only placeholders (`id`, `file_name`, `file_type`, `size_bytes`) — no real file storage until Supabase Storage is connected |
| created_by | text | actor name; becomes a real FK once auth exists |
| created_at / updated_at | timestamptz | |

### `timeline_activities`
Shared by Leads and Clients — one polymorphic, append-only table (`owner_type` + `owner_id`). Every entry is written through one shared mechanism (`recordTimelineActivity`), never constructed by hand — see `docs/workflows.md`.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces — see "Polymorphic ownership" below for why every read/write scopes by this in addition to owner_type/owner_id |
| owner_type | enum | `lead`, `client`, `event`, `contract` |
| owner_id | uuid | references leads.id, clients.id, events.id, or contracts.id, depending on owner_type — **not** a database-enforced FK; see below |
| type | enum | `lead_created`, `lead_updated`, `status_changed`, `note_added`, `note_pinned`, `note_unpinned`, `welcome_guide_sent`, `lead_archived`, `lead_converted`, `client_created`, `client_updated`, `tags_changed`, `vip_status_changed`, `communication_preference_changed`, `client_archived`, `client_restored`, `event_created`, `event_updated`, `lifecycle_stage_changed`, `priority_changed`, `checklist_item_created`, `checklist_item_completed`, `checklist_template_applied`, `schedule_item_created`, `schedule_item_updated`, `event_archived`, `event_restored`, `event_cancelled`, `event_completed`, `contract_created`, `contract_updated`, `contract_sent`, `contract_viewed`, `contract_signed`, `contract_declined`, `contract_cancelled`, `contract_completed`, `contract_archived`, `contract_restored` |
| description | text | human-readable summary |
| actor | text | who/what performed the action |
| timestamp | timestamptz | |
| metadata | jsonb | nullable — e.g. `{ from, to }` on a status change, `{ client_id }` on conversion |

#### Polymorphic ownership: no normal foreign key is possible

`notes.owner_id`, `timeline_activities.owner_id`, `checklist_items.owner_id`, and `schedule_items.owner_id` each point at one of several possible target tables depending on the row's `owner_type` — a single column referencing more than one target table. Postgres (and Supabase) cannot express that as one `FOREIGN KEY` constraint; a normal FK targets exactly one table. This is a deliberate tradeoff to avoid duplicating the same architecture per owner type (`lead_notes`/`client_notes`/`event_notes`/`contract_notes`, `event_checklist_items`/`employee_checklist_items`/etc.) as more owner types are added — `checklist_items` and `schedule_items` were built polymorphic from the start specifically so Team Management, Vendors, Inventory, and Vehicles can adopt them later without a schema change, not just Events; `notes`/`timeline_activities` gained `contract` as a fourth `owner_type` value for the same reason (Contracts reuse the shared architecture rather than introducing a dedicated `contract_notes` table — see `docs/workflows.md`).

Because referential integrity and workspace isolation can't be guaranteed by a FK here, both are enforced elsewhere instead:

- **Data layer (now):** every read/write in `lib/data/index.ts` derives `workspace_id` from the owning record and filters by `workspace_id` **and** `owner_type`/`owner_id` together — never `owner_id` alone. A note, timeline, checklist, or schedule row is only ever reachable through its actual owner's own workspace.
- **Supabase RLS (once connected):** row-level security policies must independently re-check `workspace_id` against the authenticated user's workspace, and validate that `owner_id` actually exists in the table named by `owner_type`, on every `SELECT`/`INSERT`/`UPDATE`. A `CHECK` constraint can validate `owner_type IN ('lead','client','event', ...)`, but the owner's existence and workspace match must be enforced by RLS policy logic (or trigger-based validation) rather than a FK.

Checklist assignment (`assigned_type`/`assigned_id`/`assigned_name`) is a second, smaller instance of the same pattern, prepared ahead of the Employee/Vendor modules that will eventually populate `assigned_id` for real.

### `clients`
| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| originating_lead_id | uuid | nullable FK → leads — manually-created Clients have no originating Lead |
| first_name | text | |
| last_name | text | |
| email | text | |
| phone | text | nullable |
| instagram | text | nullable |
| preferred_contact_method | enum | nullable — `email`, `phone`, `text`, `whatsapp`, `instagram` |
| partner_name | text | nullable |
| relationship_status | text | nullable — curated options in `modules/clients/constants.ts`, not a canonical enum |
| important_dates | jsonb | array of `{ id, label, date }` — custom/ad-hoc dates beyond the fixed couple-info milestones below |
| address / city / state / zip_code | text | nullable |
| source | text | nullable — how they originally came in; curated options in `modules/clients/constants.ts` |
| tags | text[] | |
| internal_status | enum | `active`, `planning`, `past_client`, `inactive`, `archived` — canonical values live in `core/enums/clientStatus.ts` |
| is_returning | boolean | true once they have more than one event |
| how_they_met / first_date / relationship_anniversary / engagement_date / wedding_date | text/date | nullable couple-info milestones |
| favorite_colors / favorite_flowers / favorite_music / favorite_food / favorite_drinks / preferred_style / disliked_elements | text | nullable couple-info preferences |
| allergies / accessibility_needs / dietary_restrictions / preferred_communication_time | text | nullable — internal-only, never exposed to a future Client Portal |
| do_not_call / surprise_event_confidentiality | boolean | internal-only operational flags |
| emergency_contact_name / emergency_contact_phone | text | nullable |
| is_vip | boolean | VIP / high-priority flag |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable, set when internal_status becomes `archived` |

### `events`
The operational center of BloomOS — the record tying a Client to a specific engagement, carrying its own independent status and lifecycle_stage state machines (`core/workflows/eventWorkflow.ts`; the earlier `lead`/`consultation`/.../`completed` single-stage model below in `docs/workflows.md` predates this and is superseded by the two-state-machine design — see the note under "MVP note on stage coverage").

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients — **required**; an Event cannot exist without a Client |
| originating_lead_id | uuid | nullable — preserved from the Client's own `originating_lead_id` when relevant; not required for a manually created Event |
| title | text | e.g. "Malibu Sunset Proposal" |
| event_type | enum | `proposal`, `anniversary`, `birthday`, `picnic`, `hotel_decoration`, `romantic_setup`, `private_dinner`, `engagement`, `micro_wedding`, `bridal_shower`, `baby_shower`, `elopement`, `styled_shoot`, `branding`, `photoshoot`, `other` — `core/enums/eventType.ts` |
| status | enum | `draft`, `inquiry`, `awaiting_contract`, `awaiting_deposit`, `confirmed`, `planning`, `ready`, `in_progress`, `completed`, `cancelled`, `archived` — `core/enums/eventStatus.ts`; `completed`/`cancelled`/`archived` are terminal, reachable only via their own dedicated action |
| lifecycle_stage | enum | `intake`, `proposal`, `booking`, `planning`, `preparation`, `setup`, `execution`, `live_event`, `breakdown`, `post_event`, `closed` — `core/enums/eventLifecycleStage.ts`; independent of `status`, never inferred from it |
| event_date / start_time / end_time / timezone | date/time/text | all nullable until confirmed |
| location_name / address / city / state / zip_code | text | nullable |
| latitude / longitude | numeric | nullable — no real maps integration yet |
| guest_count | integer | nullable |
| budget_min / budget_max | numeric | nullable |
| package_name / theme / color_palette | text | nullable |
| surprise_event | boolean | |
| confidentiality_notes / accessibility_notes / dietary_notes | text | nullable — internal-only |
| weather_plan / backup_location | text | nullable — no Weather API integration yet |
| internal_summary | text | nullable |
| assigned_owner | text | nullable — team member name; becomes a real FK once a Team Management module and auth exist |
| priority | enum | `low`, `normal`, `high`, `urgent`, `critical` — `core/enums/eventPriority.ts` |
| created_at / updated_at | timestamptz | |
| archived_at / completed_at / cancelled_at | timestamptz | nullable, set by their respective dedicated action |

### `checklist_items`
Reusable across owner types the same way `notes`/`timeline_activities` are — `owner_type` + `owner_id`, not Event-specific, even though "event" is the only real owner today. See "Polymorphic ownership" below.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | `lead`, `client`, `event` (shared `EntityType`) — only `event` populated today |
| owner_id | uuid | references the owning row — **not** a database-enforced FK; see "Polymorphic ownership" |
| title | text | |
| description | text | nullable |
| category | enum | `planning`, `client`, `venue`, `decor`, `flowers`, `photography`, `video`, `food_beverage`, `transportation`, `team`, `inventory`, `finance`, `legal`, `weather`, `setup`, `cleanup`, `post_event`, `other` |
| priority | enum | `low`, `normal`, `high`, `critical` — reuses the existing Note priority scale, not the Event priority scale (which has a fifth "urgent" tier) |
| status | enum | `pending`, `in_progress`, `blocked`, `completed`, `cancelled` |
| due_date | date | nullable |
| completed_at | timestamptz | nullable |
| assigned_type | enum | `employee`, `vendor`, `client`, `unknown` — generalized assignment; no Employee/Vendor table exists yet |
| assigned_id | uuid | nullable — references the assignee once Employee/Vendor tables exist; always null today |
| assigned_name | text | nullable — free-text display name in the meantime |
| sort_order | integer | |
| created_at / updated_at | timestamptz | |

### `schedule_items`
The day-of run-of-show. Generalized the same way as `checklist_items` — `owner_type` + `owner_id` instead of a plain `event_id` — so Employee/Vendor/Inventory/Vehicle/Client schedules can reuse this table later without a redesign.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| owner_type | enum | `lead`, `client`, `event` (shared `EntityType`) — only `event` populated today |
| owner_id | uuid | references the owning row — **not** a database-enforced FK; see "Polymorphic ownership" |
| title | text | |
| description | text | nullable |
| start_time / end_time | time | nullable |
| location | text | nullable |
| assigned_to | text | nullable — free-text; not generalized to assigned_type/id/name (only `checklist_items` assignment was, per the refinement scope) |
| category | enum | `arrival`, `delivery`, `setup`, `vendor`, `client`, `surprise`, `ceremony`, `photography`, `video`, `food_beverage`, `cleanup`, `departure`, `other` |
| status | enum | `planned`, `confirmed`, `completed`, `delayed`, `cancelled` |
| sort_order | integer | |
| created_at / updated_at | timestamptz | |

### `contracts`
Closes the commercial cycle: Lead -> Client -> Event -> Contract -> Invoice (future) -> Payments (future). Reusable across every Workspace — nothing here is designed around a single business. `client_id` is required; `event_id` is deliberately nullable — a Contract can stand on its own (e.g. a retainer) ahead of or without a dedicated Event record. Replaces the earlier draft/sent/signed/cancelled sketch below with the actual shipped model (`core/workflows/contractWorkflow.ts`).

`status` and `signature_status` are two independent state machines, the same pattern as `events.status`/`events.lifecycle_stage` — `status` is the contract's overall commercial lifecycle; `signature_status` is specifically about the e-signature process and can reach `partially_signed`, a state `status` has no equivalent for. Neither is inferred from the other.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients — **required** |
| event_id | uuid | nullable FK → events |
| template_id | uuid | nullable FK → contract_templates |
| contract_number | text | workspace-scoped and generated uniquely (`CT-{year}-{sequence}`), collision-checked on every creation/duplication |
| title | text | |
| description | text | nullable |
| status | enum | `draft`, `review`, `ready`, `sent`, `viewed`, `signed`, `completed`, `expired`, `cancelled`, `archived`, `declined` — `core/enums/contractStatus.ts`; `sent`/`viewed`/`signed`/`completed`/`expired`/`cancelled`/`archived`/`declined` are reachable only via their own dedicated data-layer action, never the plain status setter; only `draft`/`review`/`ready` remain freely inter-transitionable through it |
| signature_status | enum | `unsigned`, `sent`, `viewed`, `partially_signed`, `signed`, `declined`, `expired`, `cancelled` — `core/enums/signatureStatus.ts` |
| version | integer | starts at 1, incremented on every content edit (`updateContract`) |
| version_history | jsonb | array of `{ version, title, description, total_value, deposit_amount, recorded_at }` snapshots taken immediately before each edit overwrites them — the model's minimal version history; no separate versions table |
| effective_date / expiration_date | date | nullable |
| signed_at / sent_at / viewed_at / declined_at / cancelled_at / archived_at | timestamptz | nullable, set by their respective dedicated action |
| total_value | numeric | nullable |
| deposit_required | boolean | |
| deposit_amount | numeric | nullable — required when `deposit_required` is true, forbidden otherwise (schema-enforced) |
| remaining_balance | numeric | nullable — derived as `total_value - deposit_amount` on every create/update, not independently editable |
| currency | text | 3-letter code, uppercased |
| notes | text | nullable — plain internal free-text field (mirrors `events.internal_summary`), separate from the shared `notes` table a Contract also owns via `owner_type = 'contract'` |
| created_at / updated_at | timestamptz | |

### `contract_templates`
A reusable contract body a Contract can be created from. Workspace-scoped, reusable across Workspaces. No editor, HTML rendering, or PDF generation exists yet — `body` is plain text containing `{{merge_field}}` placeholders (see "Merge fields" below); nothing parses or renders them yet.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| name | text | |
| description | text | nullable |
| category | enum | `event_agreement`, `vendor_agreement`, `rental_agreement`, `photography_release`, `venue_rental`, `custom`, `other` — `core/enums/contractTemplateCategory.ts` |
| body | text | plain text with `{{merge_field}}` placeholders |
| version | integer | |
| active | boolean | inactive templates are excluded when `activeOnly` is requested; still readable individually |
| created_at / updated_at | timestamptz | |

### `contract_exhibits`
A named attachment/appendix to a Contract (e.g. Payment Schedule, Cancellation Policy, Rental Terms, Damage Waiver, Photo Release, Custom Attachment) — model support only this phase; no editor exists yet.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| contract_id | uuid | FK → contracts |
| title | text | |
| description | text | nullable |
| display_order | integer | |
| document_id | uuid | nullable — placeholder for the future Documents module; always null today |
| created_at / updated_at | timestamptz | |

#### Merge fields

`modules/contracts/mergeFields.ts` is the centralized registry of `{{key}}` placeholders a `contract_templates.body` may reference: `client_name`, `partner_name`, `event_date`, `event_location`, `contract_total`, `deposit_amount`, `remaining_balance`, `workspace_name`. Architecture only — nothing parses a template or substitutes a value yet; this exists so a future renderer and template editor share one list of valid fields instead of each re-deciding what a placeholder means.

### Money model

Every persisted monetary value across `invoices`/`payments`/`expenses` is an **integer minor-unit amount** (e.g. $1,250.00 is stored as `125000`), never a float — floats can't represent currency exactly and drift across repeated arithmetic. `lib/money.ts` is the single place this arithmetic happens (`formatMoney`, `calculateBalance`, `calculatePercentage`, safe `addMinor`/`subtractMinor`/`sumMinor`); no other module computes money totals ad hoc. `MINOR_UNIT_EXPONENT` (currently 2, i.e. cents) is centralized so a future 0- or 3-decimal currency only needs one constant changed. `contracts.total_value`/`contracts.deposit_amount` predate this model and remain plain major-unit numbers — every Finance summary that folds a Contract value into a `*_minor` total converts it through `majorToMinor()` rather than assuming it's already minor-unit; this is a known, deliberate seam, not an oversight.

### `invoices`
Continues the commercial cycle a Contract closes: Lead → Client → Event → Contract → Invoice → Payments → Expenses → Profit. `client_id` is required; `event_id` and `contract_id` are both nullable — a standalone Invoice (e.g. a one-off transaction with no Event or Contract on record) is legitimate. When set, `event_id`/`contract_id` must belong to the same `client_id` and `workspace_id` (data-layer validated).

Unlike `contracts.status`, there is no plain status setter — every non-`draft` value is reached through its own dedicated data-layer action (`issueInvoice`, `sendInvoice`, `markInvoiceViewed`, `markInvoiceOverdue`, `voidInvoice`, `archiveInvoice`, `restoreInvoice`) or automatically when a successful Payment is applied (`partially_paid`/`paid` — see `applyPaymentToInvoice` in `lib/data/index.ts`).

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| client_id | uuid | FK → clients — **required** |
| event_id | uuid | nullable FK → events |
| contract_id | uuid | nullable FK → contracts |
| invoice_number | text | workspace-scoped and generated uniquely (`INV-{year}-{sequence}`), collision-checked on every creation/duplication |
| title | text | |
| description | text | nullable |
| status | enum | `draft`, `issued`, `sent`, `viewed`, `partially_paid`, `paid`, `overdue`, `voided`, `archived` — `core/enums/invoiceStatus.ts` / `core/workflows/invoiceWorkflow.ts` |
| issue_date / due_date | date | nullable |
| subtotal_minor / tax_minor / discount_minor | integer | minor units; `discount_minor` cannot exceed `subtotal_minor` (schema-enforced) |
| total_minor | integer | derived as `subtotal_minor + tax_minor - discount_minor` on every create/update, not independently editable |
| paid_minor / balance_minor | integer | derived by `applyPaymentToInvoice` from every linked, currently-counting Payment (net of refunds) each time one changes — never written directly by a caller |
| currency | text | 3-letter code, uppercased |
| notes | text | nullable — plain internal free-text field, separate from the shared `notes` table an Invoice also owns via `owner_type = 'invoice'` |
| sent_at / viewed_at / paid_at / overdue_at / voided_at / archived_at | timestamptz | nullable, set by their respective dedicated action |
| created_at / updated_at | timestamptz | |

### `payments`
A single money movement — collected from a Client (`deposit`, `installment`, `final_payment`, `full_payment`, `retainer`) or paid back to one (`refund`, `reimbursement`, `adjustment`). `invoice_id` is nullable: a Payment may exist without an Invoice (e.g. a deposit collected before one is issued, or a standalone cash transaction), but always belongs to a `client_id` and `workspace_id`. When `invoice_id` is set, workspace/client consistency is validated and a `succeeded` Payment updates that Invoice's `paid_minor`/`balance_minor`/`status` through `applyPaymentToInvoice` — never written directly.

`amount_minor` is always positive, including for `payment_type: "refund"` rows — see "Refund model" below. **Never stores card numbers, bank account numbers, or any other sensitive payment credential** — `reference` is a free-text field for a check number, provider transaction id, or similarly non-sensitive identifier only. No payment-provider (Stripe/Square/PayPal/bank) integration exists; `payment_method` values are labels only.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| invoice_id | uuid | nullable FK → invoices |
| client_id | uuid | FK → clients — **required** |
| event_id | uuid | nullable FK → events |
| contract_id | uuid | nullable FK → contracts |
| payment_type | enum | `deposit`, `installment`, `final_payment`, `full_payment`, `retainer`, `reimbursement`, `refund`, `adjustment`, `other` — `core/enums/paymentType.ts` |
| status | enum | `pending`, `processing`, `succeeded`, `failed`, `partially_refunded`, `refunded`, `cancelled` — `core/enums/paymentStatus.ts` / `core/workflows/paymentWorkflow.ts`. Only `succeeded`/`partially_refunded`/`refunded` count toward an Invoice's paid total (the money actually collected net of what's since gone back) |
| payment_method | enum | `cash`, `check`, `bank_transfer`, `ach`, `credit_card`, `debit_card`, `zelle`, `venmo`, `paypal`, `stripe`, `square`, `other` — `core/enums/paymentMethod.ts`; labels only, no provider connected |
| amount_minor | integer | minor units, always positive |
| currency | text | 3-letter code |
| reference | text | nullable — non-sensitive identifier only (check number, provider transaction id) |
| transaction_date | date | |
| received_at / failed_at / refunded_at | timestamptz | nullable, set by their respective dedicated action |
| notes | text | nullable |
| document_id | uuid | nullable — placeholder for the future Documents module (a payment confirmation or receipt); always null today |
| created_at / updated_at | timestamptz | |

#### Refund model

Refunds are represented as an ordinary `payments` row with `payment_type = "refund"` rather than a second ledger — one authoritative approach, not two competing ones. `refundPayment(originalPaymentId, amountMinor)` creates this new row (status `succeeded` immediately, `amount_minor` always positive) and moves the *original* Payment's own `status` to `partially_refunded` or `refunded` depending on whether anything refundable remains. The refundable ceiling is the original Payment's `amount_minor` minus every prior refund already issued against it (tracked via `reference`, since a refund has no dedicated foreign key back to the Payment it refunds) — requesting more than that fails outright. If the original Payment was linked to an Invoice, that Invoice is recomputed through `applyPaymentToInvoice` immediately, so its `paid_minor`/`balance_minor`/`status` reflect the refund without a separate step.

### `expenses`
A cost the business incurs — Event-specific (`event_id` set), a general business expense (`event_id`/`client_id` both null), or supplier/team-related. `supplier_id` and `team_member_id` are forward-looking placeholders only — no Supplier or Team module exists yet, so neither is validated against a real table.

| Column | Type | Notes |
|---|---|---|
| id | uuid | PK |
| workspace_id | uuid | FK → workspaces |
| event_id | uuid | nullable FK → events |
| client_id | uuid | nullable FK → clients |
| contract_id | uuid | nullable FK → contracts |
| supplier_id | uuid | nullable — placeholder; future Supplier module, unvalidated today |
| team_member_id | uuid | nullable — placeholder; future Team module, unvalidated today |
| category | enum | `decor`, `flowers`, `rentals`, `venue`, `photography`, `video`, `food_beverage`, `transportation`, `printing`, `supplies`, `inventory`, `team_payroll`, `supplier_payment`, `marketing`, `software`, `insurance`, `taxes`, `fees`, `travel`, `refund`, `reimbursement`, `miscellaneous` — `core/enums/expenseCategory.ts` |
| status | enum | `planned`, `approved`, `due`, `paid`, `reimbursed`, `cancelled`, `archived` — `core/enums/expenseStatus.ts` / `core/workflows/expenseWorkflow.ts` |
| description | text | |
| amount_minor | integer | minor units, always positive |
| currency | text | 3-letter code |
| transaction_date | date | |
| due_date | date | nullable |
| paid_at / reimbursed_at | timestamptz | nullable, set by their respective dedicated action |
| reimbursable | boolean | marks an Expense a team member or supplier fronted and expects to be paid back for — distinct from `status: "reimbursed"`, which is *whether* that reimbursement has actually happened |
| reference | text | nullable |
| notes | text | nullable |
| document_id | uuid | nullable — placeholder for the future Documents module (a receipt or reimbursement proof); always null today |
| created_at / updated_at | timestamptz | |
| archived_at | timestamptz | nullable |

### Derived Event financial status

`modules/finance/eventFinancialStatus.ts`'s `EventFinancialStatus` (`no_contract`, `awaiting_invoice`, `awaiting_deposit`, `deposit_partial`, `deposit_paid`, `balance_due`, `paid_in_full`, `overdue`, `refunded`, `cancelled`) is **never persisted** — it's derived on every read from an Event's Contracts/Invoices/Payments (`getEventFinancialStatus` in `lib/data/index.ts`), the same "don't store what you can compute" precedent as `contracts.remaining_balance`. It lives outside `core/enums/` deliberately: every other enum there is the intended value set of a real column; this one has no column at all.

## Relationships

```
workspaces 1—* leads
workspaces 1—* clients
workspaces 1—* events
workspaces 1—* contracts
workspaces 1—* contract_templates
workspaces 1—* invoices
workspaces 1—* payments
workspaces 1—* expenses
leads 1—* notes                    (owner_type = 'lead')
leads 1—* timeline_activities      (owner_type = 'lead')
clients 1—* notes                   (owner_type = 'client')
clients 1—* timeline_activities     (owner_type = 'client')
events 1—* notes                    (owner_type = 'event')
events 1—* timeline_activities      (owner_type = 'event')
events 1—* checklist_items          (owner_type = 'event')
events 1—* schedule_items           (owner_type = 'event')
contracts 1—* notes                 (owner_type = 'contract')
contracts 1—* timeline_activities   (owner_type = 'contract')
contracts 1—* contract_exhibits
invoices 1—* notes                  (owner_type = 'invoice')
invoices 1—* timeline_activities    (owner_type = 'invoice')
payments 1—* notes                  (owner_type = 'payment')
payments 1—* timeline_activities    (owner_type = 'payment')
expenses 1—* notes                  (owner_type = 'expense')
expenses 1—* timeline_activities    (owner_type = 'expense')
leads 1—0/1 clients        (via clients.originating_lead_id)
clients 1—* events                  (event.client_id — required)
clients 1—* contracts               (contract.client_id — required)
clients 1—* invoices                (invoice.client_id — required)
clients 1—* payments                (payment.client_id — required)
clients 1—0/* expenses              (expense.client_id — optional)
leads 1—0/1 events                  (via events.originating_lead_id, optional)
events 1—0/* contracts              (contract.event_id — optional)
events 1—0/* invoices               (invoice.event_id — optional)
events 1—0/* payments               (payment.event_id — optional)
events 1—0/* expenses               (expense.event_id — optional)
contract_templates 1—0/* contracts  (contract.template_id — optional)
contracts 1—0/* invoices            (invoice.contract_id — optional)
contracts 1—0/* payments            (payment.contract_id — optional)
contracts 1—0/* expenses            (expense.contract_id — optional)
invoices 1—0/* payments             (payment.invoice_id — optional)
```

## Post-MVP tables (not created yet)

Anticipated, not implemented: `inventory_items`, `suppliers`, `team_members`, `event_team_assignments`, `vehicles`, `documents`, `client_portal_access`, `automations`, `automation_runs`, `emails`, `gallery_media`, `feedback`, `knowledge_base_articles`. When these ship, `checklist_items.owner_type`/`schedule_items.owner_type` and `checklist_items.assigned_type` are expected to gain `employee`/`vendor`/`inventory`/`vehicle` values rather than needing new tables — that reuse is the reason those two tables were generalized ahead of time. These will be specified in detail when their phase (see `ROADMAP.md`) begins.

`payments.document_id` and `expenses.document_id` are placeholders for the future `documents` table specifically — once it exists, it's expected to attach invoices, receipts, payment confirmations, expense receipts, reimbursement proofs, and tax documents to the record that references it, the same way `contract_exhibits.document_id` is a placeholder today. No document upload or storage exists yet.

No payment-provider (Stripe, Square, PayPal, banks, accounting software) is connected. `payments.payment_method` values that name a provider (`stripe`, `square`, `paypal`, `credit_card`, `debit_card`) are labels only, recorded exactly like `cash`/`check`/`zelle`/`venmo` — none of them trigger a real charge, webhook, or reconciliation. `createPayment`'s initial `status` (`succeeded` for manual/bank-style methods, `pending` for card/wallet-style ones) simulates the outcome a provider round-trip would eventually produce, nothing more. **No card numbers, bank account numbers, or other sensitive payment credentials are ever stored** — `payments.reference` is a free-text field limited to non-sensitive identifiers (a check number, a provider transaction id).

## Supabase-specific notes

- Row-Level Security (RLS) is designed alongside the schema but **enabled only once Supabase is actually connected** with real credentials — see `docs/permissions.md`.
- Enum values above are the intended constraint; whether they're implemented as Postgres `enum` types or `check` constraints is an implementation decision made at connection time, not before.
