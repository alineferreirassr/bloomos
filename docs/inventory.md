# Inventory

**Status: foundation only.** Types, workflow, mock repository, and Core integration exist; no UI, no Supabase migration, no Vendors/Events/Finance integration. See `CHANGELOG.md` for the phase this shipped in.

## InventoryItem

The physical or reusable asset record — flowers, candles, vases, arches, tableware, lighting, and similar. Covers both:

- **`consumable`** — bought once, used up (e.g. candles, floral supplies). `condition` is always `null`; a consumable is never assessed for physical condition.
- **`reusable`** — bought once, checked out and returned across many Events (e.g. an arch, a settee, glassware). `condition` is one of `new`/`excellent`/`good`/`fair`/`damaged`/`under_repair`/`retired`, or `null` when not yet assessed.

`status` is `active`/`inactive`/`archived`. `active`↔`inactive` is a normal edit; `archived` is reachable only through `archiveInventoryItem`/`restoreInventoryItem`, never the general update — same terminal-state-via-dedicated-action pattern as every other BloomOS module.

Money fields (`unit_cost`, `replacement_cost`, `rental_value`) are integer minor units (cents), matching `lib/money.ts` and every Finance type — never a float.

`category`/`subcategory`/`unit_of_measure` are curated free text for now (no canonical enum), matching the precedent set by `Client.relationship_status`/`Client.source`.

## InventoryMovement

An append-only ledger entry recording *why* an item's quantity changed. `InventoryItem.quantity_on_hand`/`quantity_available`/`quantity_reserved` are never written directly outside of movement application — every change to them happens through `recordInventoryMovement`, which computes the new quantities from the movement type and appends a row.

`InventoryRepository` has no update/delete method for movements — immutability is enforced at the contract level, the same way `AuditLogRepository` has no update/delete method.

### Quantity semantics

- `quantity_on_hand` — physically in our possession right now. A reusable item checked out to an Event genuinely isn't on hand until it returns.
- `quantity_available` — on hand and not committed to anything.
- `quantity_reserved` — committed (usually to an upcoming Event) but not yet physically removed.

Invariants enforced on every movement (`core/workflows/inventoryWorkflow.ts`):
`quantity_available <= quantity_on_hand`, `quantity_reserved <= quantity_on_hand`, no quantity is ever negative.

### Movement effects

| Movement type | on_hand | available | reserved |
|---|---|---|---|
| `initial_stock`, `purchase`, `adjustment_increase`, `event_return` | +qty | +qty | — |
| `adjustment_decrease`, `damage`, `loss`, `disposal` | −qty | −qty | — |
| `reservation` | — | −qty | +qty |
| `reservation_release` | — | +qty | −qty |
| `event_checkout` | −qty | — | −qty |

`reservation` only moves stock between `available` and `reserved` — nothing physically leaves. `event_checkout` is what actually consumes a reservation and removes the stock from hand; `event_return` restores it.

## Core integration

- **EntityType** — `"inventory_item"` (row-level, matching every other value's granularity — not `"inventory"`, which would have named the module rather than a record).
- **Notes, Timeline, Tags, Attachments, Audit Log** — all accept `owner_type: "inventory_item"` automatically, since each is typed generically by `EntityType`. No Inventory-specific wrapper methods were added to `InventoryRepository` for these — call the Core front doors directly (`@/core/notes`, `@/core/timeline`, `@/core/tags`, `@/core/files`) with `"inventory_item"` as the owner type.
- **Timeline activity types** — registered via `registerTimelineActivityType` (`@/core/timeline`) at repository module-init time, not added to `core/enums/timelineActivityType.ts`. This is the extensible-registry path Core's Timeline generalization exists for.
- **Audit Log** — wired into every state-changing mutation (`createInventoryItem`, `updateInventoryItem`, `archiveInventoryItem`, `restoreInventoryItem`, `recordInventoryMovement`), matching the Clients Core-integration precedent.
- **Search** — `"inventory_item"` is registered in `core/search/defaultRegistrations.ts` with no route (module unbuilt).
- **Media Library** — `"inventory_item"` is in `MEDIA_ASSET_OWNER_TYPES` (aspirational) but not yet in `LIVE_MEDIA_ASSET_OWNER_TYPES` — real Attachments support arrives with the Inventory migration, matching how every other module widened this list.
- **Notifications** — deliberately not wired to any Inventory event; no policy exists yet for who should be notified about low stock or damage.

## Deferred to later phases

- **UI** — list/detail/create/edit views, movement history display, low-stock/damaged dashboards.
- **Supabase migration** — `inventory_items`/`inventory_movements` tables, RLS, triggers. `lib/data/inventory/supabaseRepository.ts` is a typed placeholder that throws rather than querying a table that doesn't exist.
- **Vendors integration** — `primary_vendor_id` is a plain nullable string today, no FK, no Vendor record to point at yet.
- **Events integration** — `event_checkout`/`event_return` movement types and `reference_type`/`reference_id` exist as generic extension points but nothing populates them; reserving/checking out stock for a specific Event is future work.
- **Finance integration** — `unit_cost`/`replacement_cost`/`rental_value` are stored but not yet connected to Expense tracking or rental invoicing.
- **Bloom AI** — no AI integration of any kind this phase.
