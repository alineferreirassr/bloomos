# Purchases

**Status: foundation only.** Types, workflow, mock repository, and Core integration exist; no UI, no Supabase migration, no navigation route. See `CHANGELOG.md` for the phase this shipped in.

## Domain model

A **Purchase** is a purchase order placed with a Vendor. One record represents the whole lifecycle — draft through received — via `status`, the same way Invoice represents draft-through-paid in one row rather than separate "order" and "receipt" entities. There is no separate "purchase order" vs. "completed purchase" entity; `status` is the only thing that changes.

Line items are a separate **PurchaseItem** entity (own table, own id), not an embedded array — mirroring `ContractExhibit`'s precedent rather than inventing a new shape. `PurchaseItem.workspace_id` is duplicated from the parent Purchase (same rationale as `ContractExhibit.workspace_id`: RLS can gate on it directly without a join once a real migration exists).

`vendor_id` and `PurchaseItem.inventory_item_id` both have **no FK yet** — the same disclosed limitation `InventoryItem.primary_vendor_id` already carries. All three (Purchases↔Vendors, Purchases↔Inventory, Inventory↔Vendors) are expected to gain real foreign-key constraints together in Purchases' own migration phase.

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
- **Notes/Timeline/Attachments owner compatibility** — `"purchase"` is now a valid `EntityType`, so Notes/Timeline already work in mock mode via the repository methods listed above. Attachments (MediaAsset) are **not** wired this phase — `"purchase"` is not added to `LIVE_MEDIA_ASSET_OWNER_TYPES` (`src/lib/media/ownerTypes.ts`) yet, following the established discipline that a MediaAsset owner type is only widened once its module has a live Supabase table. This is a one-line change deferred to the migration phase, not a design gap.
- **Notifications** — deliberately not wired to any Purchases event, matching Inventory's own precedent (no notification policy exists yet for "a purchase is overdue" or similar).

## What is intentionally deferred

- **UI** — list/detail/create/edit views, receiving actions, receipt-history display, open/overdue dashboards. No route was added to `config/navigation.ts`.
- **Supabase migration** — `purchases`/`purchase_items` tables, RLS, triggers, and the real foreign keys to `vendors`/`inventory_items`. `lib/data/purchases/supabaseRepository.ts` is a typed placeholder until then.
- **Finance integration** — Purchases are not connected to Expense tracking, Accounts Payable, or any accounting function. No approval workflows, departments, budgets, or warehouses exist anywhere in this domain — none of those concepts are present elsewhere in the project, so none were invented here.
- **Live Inventory RPC call** — the mock repository calls `mockInventoryRepository` directly; the equivalent Supabase-mode call (through the real `record_inventory_movement` Postgres function) is deferred to Purchases' own migration/Supabase-repository phase.
- **Bloom AI** — no AI integration of any kind this phase.
