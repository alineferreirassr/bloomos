-- Purchases migration 2 of 7: purchase_items table.
--
-- One line of a Purchase. Mirrors src/types/purchaseItem.ts exactly, and
-- mirrors contract_exhibits' precedent of a real child entity (own table,
-- own id, workspace_id duplicated from the parent so RLS can gate on it
-- directly without a join through purchases) rather than an embedded array
-- on purchases.
--
-- purchase_id is a real, non-polymorphic foreign key with `on delete
-- cascade` — the same shape contract_exhibits.contract_id already uses: a
-- Purchase is never physically deleted by the application, so the cascade
-- never actually fires, but it's the technically correct clause for a
-- true single-parent child row.
--
-- inventory_item_id is nullable (a line can be a real Inventory item being
-- restocked, or a non-inventory expense/service that never touches
-- Inventory at all) with `on delete set null` — the same nullable-optional-
-- reference shape invoices.contract_id/contracts.event_id already use.
-- Inventory items are themselves only ever soft-archived, never physically
-- deleted, so this clause never actually fires either; it exists so that
-- IF an Inventory row were ever removed, the Purchase's own history
-- (name/sku snapshots, quantities, cost) survives intact rather than the
-- whole line disappearing or the FK blocking the delete.
--
-- name/sku are point-in-time snapshots (never a live join to
-- inventory_items) — this is what keeps a line's own history stable even
-- if the linked Inventory item's name or SKU changes later.
--
-- quantity_received starts at 0 and only ever changes through
-- PurchasesRepository.receivePurchaseItem, never a direct field edit — the
-- same "quantity is movement-controlled" invariant inventory_items'
-- quantity_on_hand/quantity_available/quantity_reserved already enforce,
-- reflected here as a CHECK rather than trusted to application discipline
-- alone.
--
-- line_subtotal_minor's consistency with unit_cost_minor * quantity_ordered
-- is enforced as an exact-equality CHECK — both factors are whole integers
-- (minor-unit cents and a plain count), so the product has no rounding
-- hazard and is safe to pin down at the database layer.
--
-- Removal is a genuine hard DELETE (see removePurchaseItem in
-- lib/data/purchases/repository.ts, which explicitly mirrors
-- deleteContractExhibit) — the smallest consistent model, since the
-- repository already restricts removal to draft Purchases with zero
-- quantity_received before a row is ever deleted; no soft-deletion concept
-- is introduced here. See migration 6 of 7 for the corresponding delete RLS
-- policy.

create table if not exists public.purchase_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  name text not null,
  sku text,
  quantity_ordered integer not null,
  quantity_received integer not null default 0,
  unit_cost_minor integer not null,
  line_subtotal_minor integer not null,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint purchase_items_name_not_blank_check check (btrim(name) <> ''),
  constraint purchase_items_quantity_ordered_check check (quantity_ordered > 0),
  constraint purchase_items_quantity_received_check check (
    quantity_received >= 0 and quantity_received <= quantity_ordered
  ),
  constraint purchase_items_unit_cost_minor_check check (unit_cost_minor >= 0),
  constraint purchase_items_line_subtotal_minor_check check (line_subtotal_minor >= 0),
  constraint purchase_items_line_subtotal_consistency_check check (
    line_subtotal_minor = unit_cost_minor * quantity_ordered
  ),
  constraint purchase_items_display_order_check check (display_order >= 0)
);

comment on table public.purchase_items is
  'Line items of a Purchase. Mirrors src/types/purchaseItem.ts. quantity_received changes only via PurchasesRepository.receivePurchaseItem, never a direct UPDATE from application code. Removal is a genuine hard DELETE, restricted by the repository to draft Purchases with zero quantity_received.';
