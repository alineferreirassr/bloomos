# Purchases

**Status: schema ready, repository not yet migrated.** Types, workflow, mock repository, Core integration, and the live Supabase schema (`purchases`/`purchase_items` tables, RLS, indexes, triggers) all exist. `lib/data/purchases/supabaseRepository.ts` is still a throwing placeholder — no live Supabase repository, no UI, no navigation route yet. See `CHANGELOG.md` for the phase this shipped in.

## Domain model

A **Purchase** is a purchase order placed with a Vendor. One record represents the whole lifecycle — draft through received — via `status`, the same way Invoice represents draft-through-paid in one row rather than separate "order" and "receipt" entities. There is no separate "purchase order" vs. "completed purchase" entity; `status` is the only thing that changes.

Line items are a separate **PurchaseItem** entity (own table, own id), not an embedded array — mirroring `ContractExhibit`'s precedent rather than inventing a new shape. `PurchaseItem.workspace_id` is duplicated from the parent Purchase (same rationale as `ContractExhibit.workspace_id`: RLS can gate on it directly without a join once a real migration exists).

`vendor_id` and `PurchaseItem.inventory_item_id` are **real foreign keys** as of the Database Schema phase (see "Database schema" below) — `Purchase.vendor_id` and `PurchaseItem.inventory_item_id` reference `vendors`/`inventory_items` respectively. `InventoryItem.primary_vendor_id` itself still has no FK — that specific column was out of scope for this phase (it belongs to Inventory's own migration, not Purchases').

## Status workflow

`core/enums/purchaseStatus.ts` defines six values: `draft`, `submitted`, `partially_received`, `fully_received`, `cancelled`, `archived`. `archived` is a real status member (not a separate boolean), matching Invoice's own enum shape — a Purchase is never in two places at once.

`core/workflows/purchaseWorkflow.ts`'s `canTransitionPurchaseStatus` is the single source of truth for legal transitions:

| From | Can move to |
|---|---|
| `draft` | `submitted`, `cancelled`, `archived` |
| `submitted` | `partially_received`, `fully_received`, `cancelled`, `archived` |
| `partially_received` | `fully_received`, `cancelled`, `archived` |
| `fully_received` | `archived` |
| `cancelled` | `archived` |
| `archived` | `draft` |

There is no plain status setter — every transition goes through its own dedicated repository method (`submitPurchase`, `cancelPurchase`, `archivePurchase`, `restorePurchase`), matching Invoice's own repository (no `setInvoiceStatus` exists either). **`partially_received`/`fully_received` are never caller-settable at all** — they are only ever reached automatically, by `receivePurchaseItem`'s internal recompute (`recomputePurchaseAggregates`), the same way Invoice's `partially_paid`/`paid` are only reached by payment application, never a direct setter.

**Restoring an archived Purchase always returns it to `draft`** — mirroring Invoice's own `archived → draft` simplification exactly. The underlying subtotal/total/item receipt records are untouched and still visible; only the workflow status label resets. A restored Purchase should be treated as needing a fresh look (re-submit it if it's genuinely still an open order) rather than silently resuming wherever it left off, which would otherwise require a separate "status before archiving" field this Foundation phase deliberately doesn't add.

Additional rules enforced by the repository (`core/workflows/purchaseWorkflow.ts`'s `canEditPurchase`/`canEditPurchaseItems`/`canRemovePurchaseItem`/`canReceivePurchase`):

- The Purchase header may be edited while `draft` or `submitted` only — once receiving has begun, or the order is cancelled/archived, it's frozen.
- Line items may be added, edited, or removed only while `draft` — once submitted, the order that was placed is fixed; further change happens through receiving, not editing.
- A line item may be removed only while its Purchase is `draft` **and** nothing has been received against it yet.
- Receiving is only legal while `submitted` or `partially_received` — a `draft` has nothing to receive yet, and `cancelled`/`fully_received`/`archived` all reject it outright.

## Line-item model

`PurchaseItem.inventory_item_id` is **nullable** — a line can be a real Inventory item being restocked, or a non-inventory expense/supply (a delivery fee, a one-off rental, a service) that never touches Inventory at all. `name`/`sku` are point-in-time **snapshots** taken when the line is added, never a live join back to the Inventory item — so a line's own history stays stable even if the Inventory item's name/SKU changes later.

`quantity_received` starts at 0 and only ever changes through `receivePurchaseItem` — never a direct field edit, the same "movement-controlled, not directly editable" invariant Inventory's own `quantity_on_hand`/`quantity_available`/`quantity_reserved` already enforce.

Removal is a real **hard delete** (matching `deleteContractExhibit`, the one entity type in this codebase with one) — a never-submitted draft line has no historical significance worth preserving. Once anything has been received against a line, it can no longer be removed at all (draft-only removal, checked against both the parent's status and the line's own `quantity_received`).

## Totals strategy

Every money field is an integer minor unit (cents), matching `lib/money.ts` and every other monetary field in the codebase — never a float.

- `tax_minor`/`shipping_minor`/`discount_minor` are **caller-supplied** — plain inputs on `PurchaseInput`.
- `subtotal_minor` and `total_minor` are **always recomputed by the repository, never accepted from a caller** — the same "derived, not trusted from input" rule Invoice's own `total_minor` follows. `subtotal_minor` is the sum of every current `PurchaseItem.line_subtotal_minor`; `total_minor` is `subtotal + tax + shipping - discount`.
- Both are recomputed and re-persisted on every item add/update/remove/receive (`recomputePurchaseAggregates`) — the same "recompute from the child ledger every time it changes, never patch incrementally" shape as Invoice's `applyPaymentToInvoice`.
- A negative total (typically from a discount larger than everything else) is rejected outright by `createPurchase`/`updatePurchase` — totals must remain internally consistent.

`PurchaseItem.line_subtotal_minor` is likewise always `unit_cost_minor * quantity_ordered`, recomputed whenever the line changes, never caller-supplied.

Reusable calculation helpers (`core/workflows/purchaseWorkflow.ts`): `computeLineSubtotal`, `computePurchaseSubtotal`, `computePurchaseTotal`. No new arithmetic primitives were added to `lib/money.ts` — `addMinor`/`subtractMinor`/`sumMinor` already cover everything needed.

## Vendor relationship

`Purchase.vendor_id` is required and validated against a real Vendor row at `createPurchase` time (`Please select a valid vendor.` if not found) — the same "read the referenced store and fail with a field error" pattern Finance's own `createInvoice` uses for `client_id`. It is immutable after creation (no field for it on `PurchaseInput` at all).

`getPurchasesByVendorId`/`getOpenPurchases`/`getOverduePurchases` are the query surface for "what does this Vendor owe us" / "what's still outstanding" — `getOverduePurchases` is `getOpenPurchases` further filtered to `expected_delivery_date` already in the past.

## Inventory relationship and the receiving boundary

Receiving a Purchase item linked to an Inventory item calls straight into the **already-implemented** `mockInventoryRepository.recordInventoryMovement`, using the `"purchase"` movement type that already existed in `core/enums/inventoryMovementType.ts` and was unused until now — **no new movement type was needed or added**. This means:

- The delta math (`getInventoryMovementDelta`) and quantity invariants (`validateInventoryQuantities`) live in exactly one place — `core/workflows/inventoryWorkflow.ts` — never duplicated inside Purchases.
- `reference_type: "purchase"` / `reference_id: <purchase id>` are populated on the resulting `InventoryMovement`, so a movement can always be traced back to the Purchase that caused it.
- A non-inventory line (no `inventory_item_id`) simply updates its own `quantity_received` — there's nothing for Inventory to do.
- After either path, the parent Purchase's subtotal/total/status are recomputed immediately (`recomputePurchaseAggregates`).

**This Foundation phase never calls a live Supabase RPC** — `lib/data/purchases/mockRepository.ts` calls `mockInventoryRepository` directly (a peer mock repository, not the mode-selecting `@/lib/data` barrel, which would create a circular import). Once Purchases gets its own Supabase migration and repository, the equivalent call there will go through the real `record_inventory_movement` Postgres function the same way Inventory's own UI already does — that wiring is deferred, not designed differently.

## Archive behavior

Never a hard delete for a Purchase — `archivePurchase`/`restorePurchase` is the only lifecycle transition out of/into normal use, matching every other BloomOS module's soft-delete convention. `PurchaseItem` removal, by contrast, genuinely deletes the row (see "Line-item model" above) — only while draft and unreceived, so nothing of business value is ever lost.

## Database schema

Seven migrations (`supabase/migrations/20260801100000` through `20260801100600`), mirroring Inventory's own seven-file structure: table, table, owner-type widening, updated_at triggers, RLS × 2, indexes/constraints.

**Tables.** `purchases` and `purchase_items` persist every field on the `Purchase`/`PurchaseItem` domain types exactly — no column exists that isn't justified by the Foundation phase's own shape. Both use the standard `id uuid primary key default gen_random_uuid()` / `workspace_id uuid not null references public.workspaces (id) on delete cascade` / `created_at`/`updated_at timestamptz not null default now()` shape every other module's table already uses. Money fields are `integer` minor units (matching Invoice/Inventory, not `bigint` or `numeric`) — no float column anywhere. `purchases.created_by` is free text (matching `notes.created_by`, not a foreign key to `auth.users`), since the app stamps this column with a fixed actor label (`core/constants/actor.ts`'s `CURRENT_ACTOR`), the same convention `inventory_movements.performed_by` already uses.

**Persisted vs. derived totals.** `subtotal_minor`, `tax_minor`, `shipping_minor`, `discount_minor`, `total_minor`, and `line_subtotal_minor` are all persisted columns (not computed at query time) — matching how Invoice's own money fields are stored, recomputed by the application on every relevant mutation rather than derived via a view or generated column. Two consistency CHECK constraints back this up at the database layer: `purchases_total_consistency_check` (`total_minor = subtotal_minor + tax_minor + shipping_minor - discount_minor`) and `purchase_items_line_subtotal_consistency_check` (`line_subtotal_minor = unit_cost_minor * quantity_ordered`). Both are safe to enforce as exact equalities — every input is a whole-cent integer or a plain count, so there's no floating-point rounding hazard the way there would be with a fractional type. This goes one step further than Invoice's own migration (which only checks `total_minor >= 0`, not full consistency) because Purchases' arithmetic is simpler — no percentage-based tax calculation or partial-payment ledger sits between the inputs and the total.

**Status.** A single `purchases_status_check` CHECK constrains `status` to the six known values as a plain `text` CHECK — not a Postgres `enum` type, matching every other status-like column in this schema (`inventory_items.status`, `invoices.status`, etc). The full transition graph (`core/workflows/purchaseWorkflow.ts`'s `PURCHASE_TRANSITIONS`) is deliberately **not** encoded as a database constraint — enforcing "`fully_received` may only move to `archived`" at the SQL layer would require a stateful trigger comparing old/new values, which every other module in this codebase leaves to the repository layer instead.

**Relationships and deletion behavior.** `purchases.vendor_id` is `not null references public.vendors (id)` with no explicit `on delete` clause (defaults to `RESTRICT`) — the same shape `invoices.client_id`/`events.client_id` already use for a required parent that is only ever soft-archived, never physically deleted. A Vendor archive (`archived_at`) never touches this FK, so Purchase history is always preserved; only a genuine hard `DELETE FROM vendors` (which no application code ever performs) would be blocked by it. `purchase_items.purchase_id` is `not null references public.purchases (id) on delete cascade` — the same shape `contract_exhibits.contract_id` uses for a true single-parent child row; Purchases are never physically deleted, so the cascade is correct-but-dormant. `purchase_items.inventory_item_id` is nullable with `on delete set null` — matching `invoices.contract_id`/`contracts.event_id`'s nullable-optional-reference shape — so that if an Inventory row were ever physically removed, the Purchase's own history (its `name`/`sku` snapshots, quantities, and cost) survives with the reference cleared, rather than the whole line disappearing or the delete being blocked. In practice Inventory items are only ever soft-archived too, so this clause is also dormant today, but it's the correct choice for the column's stated purpose.

**Purchase item removal.** Hard delete, not soft delete — `purchase_items` has no `deleted_at`/`archived_at` column and gets a genuine `DELETE` RLS policy, exactly mirroring `contract_exhibits` (the one other entity in this codebase with a real hard-delete policy). This was a deliberate "smallest consistent model" choice: the repository already restricts `removePurchaseItem` to `draft` Purchases with `quantity_received = 0`, so a line that can be deleted has no receiving history to protect and no audit value worth preserving as a tombstone row. Repository logic — not a database constraint — is what enforces the draft-only/nothing-received restriction; the CHECK constraints here only cover single- and cross-column data invariants, matching the codebase's consistent division of responsibility between application-layer workflow rules and database-layer data invariants.

**Purchase number uniqueness.** `purchases_workspace_number_unique` is a plain (non-partial) unique index on `(workspace_id, purchase_number)` — matching `invoices_workspace_number_unique`/`contracts_workspace_number_unique`, not the partial-index shape `vendors_workspace_tax_id_unique`/`inventory_items_workspace_sku_unique` use. The difference: `purchase_number` is `not null` and always populated (like `invoice_number`/`contract_number`), so there's no "optional column, exclude nulls" case to handle. Archived Purchases are **included** in the uniqueness check, matching Invoice/Contract's own behavior — an archived Purchase's number can never be reused within the same workspace.

**RLS.** Both tables are workspace-isolated via `is_workspace_member(workspace_id)`, `authenticated`-only, no anonymous access, no bare `using (true)` policy anywhere. `purchases` gets `SELECT`/`INSERT`/`UPDATE` only (soft delete via `archived_at`, reversible, never a physical `DELETE` — same as every other top-level business table). `purchase_items` additionally gets a `DELETE` policy, since `removePurchaseItem` is a genuine hard delete. `purchase_items`' policies gate on its own duplicated `workspace_id` column directly rather than joining through `purchases` — the same mechanism `contract_exhibits` uses — which is what guarantees a child row can never be read or written outside its parent Purchase's workspace, since the application always writes `purchase_items.workspace_id` to match its parent.

**Indexes.** `purchases`: `workspace_id`; `workspace_id, vendor_id`; `workspace_id, status`; `workspace_id, order_date`; `workspace_id, expected_delivery_date`; `workspace_id, archived_at`; plus the `purchase_number` unique index above (no separate plain index on `workspace_id, purchase_number` — the unique index already covers that access path, avoiding the redundancy Vendors'/Inventory's own index migrations were careful to avoid). `purchase_items`: `workspace_id`; `purchase_id`; `inventory_item_id`; `purchase_id, display_order`.

**Attachment ownership.** `media_assets_owner_type_check` is widened to add `'purchase'` in this phase (alongside the `notes`/`timeline_activities` owner-type widening), and `src/lib/media/ownerTypes.ts`'s `LIVE_MEDIA_ASSET_OWNER_TYPES` gets the matching one-line addition — both conditions the Foundation phase's own doc comment flagged as "deferred to the migration phase, not a design gap" are now satisfied: a live `purchases` table exists, and the established per-module pattern (every prior module widens `media_assets` in its own schema-creation phase) applies here too, since a Purchase Order plausibly needs to attach vendor quotes, packing slips, or vendor invoices. `'purchase_item'` is **not** added as a Core owner type anywhere — Purchase items remain subordinate to their parent Purchase for Notes/Timeline/Attachments purposes, the same way `contract_exhibits` never became its own Core owner type.

**Search.** No database changes were needed or made — `core/search/` has no database-reading layer at all today (`nullSearchProvider` is the only registered `SearchProvider`, and it always returns `[]`); the TypeScript-side registration Purchases already has (`core/search/defaultRegistrations.ts`) is the entirety of Purchases' Search support until a real search backend exists.

**Future receiving RPC.** No RPC was added this phase — `receivePurchaseItem` still routes through the mock repository. The schema as designed does not block a future atomic version: a `record_purchase_receipt`-style function (mirroring `record_inventory_movement`'s `security invoker`/row-locking/custom-error-code shape) could `select ... for update` both the target `purchases` row and `purchase_items` row, validate `status`/quantity via the same rules `purchaseWorkflow.ts` already encodes, call (or reproduce) `record_inventory_movement` for an Inventory-linked line, update `quantity_received`, recompute `subtotal_minor`/`total_minor`/`status`/`actual_received_date`, and insert one `timeline_activities` row — all inside one transaction, the same shape `create_document_version`/`recompute_invoice_balance`/`record_inventory_movement` already establish. Composing that RPC with the existing `record_inventory_movement` function safely (calling it from within another `security invoker` function, so the caller's own row-level permissions still apply end-to-end) appears straightforward given the two functions' matching `security invoker`/`set search_path = public` shape — no architectural obstacle was found. Building it is deferred to the Supabase repository implementation phase, not attempted here.

## Repository methods

`PurchasesRepository` (`lib/data/purchases/repository.ts`):

**Purchases** — `listPurchases`, `getPurchase`, `createPurchase`, `updatePurchase`, `submitPurchase`, `cancelPurchase`, `archivePurchase`, `restorePurchase`.

**Items** — `listPurchaseItems`, `addPurchaseItem`, `updatePurchaseItem`, `removePurchaseItem`.

**Receiving** — `receivePurchaseItem`, `getPurchaseReceiptSummary`.

**Queries** — `getPurchasesByVendorId`, `getOpenPurchases`, `getOverduePurchases`.

**Notes/Timeline** — `getTimelineByPurchaseId`, `getNotesByPurchaseId`, `createPurchaseNote`, `updatePurchaseNote`, `togglePurchaseNotePin` — included from this first Foundation phase (not deferred to a later "UI Foundation" pass, the way Inventory's original file didn't have them). Vendor's own repository shipped these from its very first commit, and that — not Inventory's original, later-amended file — is the current convention this codebase follows for a brand-new domain. All five delegate to Core's Timeline/Notes front doors (`getCoreTimelineService()`/`getCoreNotesService()`), never a Purchases-only store. There is deliberately no `deletePurchaseNote` — Notes are never deleted anywhere in this codebase.

`lib/data/purchases/supabaseRepository.ts` is a typed placeholder that throws immediately (`notYetMigrated()`) rather than querying a table that doesn't exist or silently falling back to mock data in supabase mode — byte-for-byte the same pattern Inventory Foundation's own original placeholder used.

## Core integration

- **EntityType** — `"purchase"` added to `core/enums/entityType.ts`, reserved the same way `"inventory_item"`/`"vendor"` were: no live route or migration yet, added now so Notes/Timeline/Search/Audit can type-check against it ahead of the UI/migration phases.
- **Timeline activity types** — registered centrally in `core/timeline/defaultActivityTypeRegistrations.ts` (`registerDefaultTimelineActivityTypes`), the current canonical convention (the one Vendor's domain — the more recently built of the two precedents — established), not the older module-scope `registerTimelineActivityType` calls Inventory's original mock repository used. Nine types: `purchase_created`, `purchase_updated`, `purchase_status_changed`, `purchase_archived`, `purchase_restored`, `purchase_item_added`, `purchase_item_updated`, `purchase_item_removed`, `purchase_item_received`.
- **Audit Log** — wired into every state-changing mutation (create/update/submit/cancel/archive/restore/item add/update/remove/receive), matching Inventory's own Audit Log integration. `getCoreAuditLogService()` is mock-only across the whole codebase today (a disclosed, pre-existing limitation, not fixed here).
- **Search** — `"purchase"` registered in `core/search/defaultRegistrations.ts` with no `route` (module unbuilt) — same reserved-ahead-of-shipping precedent as Inventory/Vendor.
- **Notes/Timeline/Attachments owner compatibility** — `"purchase"` is now a valid `EntityType`, so Notes/Timeline already work in mock mode via the repository methods listed above. Attachments (MediaAsset) are now wired at both layers as of the Database Schema phase: `"purchase"` is in `LIVE_MEDIA_ASSET_OWNER_TYPES` (`src/lib/media/ownerTypes.ts`) and in the `media_assets_owner_type_check` database constraint (see "Database schema" below). No Attachments UI exists yet for Purchases, but the data-layer path is unblocked.
- **Notifications** — deliberately not wired to any Purchases event, matching Inventory's own precedent (no notification policy exists yet for "a purchase is overdue" or similar).

## What is intentionally deferred

- **UI** — list/detail/create/edit views, receiving actions, receipt-history display, open/overdue dashboards. No route was added to `config/navigation.ts`.
- **The real Supabase repository** — `lib/data/purchases/supabaseRepository.ts` is still a typed placeholder (`notYetMigrated()`) even though the schema it will query now exists live. Wiring it up — including `generate_purchase_number`, a real `receivePurchaseItem` implementation, and (optionally) the atomic receiving RPC sketched above — is its own future phase.
- **Finance integration** — Purchases are not connected to Expense tracking, Accounts Payable, or any accounting function. No approval workflows, departments, budgets, or warehouses exist anywhere in this domain — none of those concepts are present elsewhere in the project, so none were invented here.
- **Live Inventory RPC call** — the mock repository calls `mockInventoryRepository` directly; the equivalent Supabase-mode call (through the real `record_inventory_movement` Postgres function, or a future composing `record_purchase_receipt`) is deferred to the Supabase repository phase.
- **Bloom AI** — no AI integration of any kind this phase.
