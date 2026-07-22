-- Inventory migration 2 of 7: inventory_movements table.
--
-- Append-only ledger recording why an inventory_items row's quantity
-- changed. Mirrors src/types/inventoryMovement.ts exactly. There is
-- deliberately no updated_at column and no trigger — matching
-- timeline_activities' precedent (an immutable log entry has nothing to
-- update). Immutability is enforced at three layers: no updated_at/no
-- UPDATE trigger here, no update/delete RLS policy (see migration 6 of 7),
-- and no update/delete method on InventoryRepository at the application
-- layer.
--
-- inventory_item_id is a real foreign key (unlike notes/timeline_activities'
-- polymorphic owner_id) — a movement always belongs to exactly one
-- inventory_items row, never a polymorphic owner, so a normal FK applies
-- cleanly here.
--
-- reference_type/reference_id are generic, unenforced extension points
-- (text, not a FK) — reserved for a future Event checkout/return or Vendor
-- purchase reference; nothing populates them yet.
--
-- quantity is always the positive magnitude of the change; quantity_before/
-- quantity_after carry the actual before/after quantity_on_hand values.
-- Direction is implied by movement_type — see
-- core/workflows/inventoryWorkflow.ts's getInventoryMovementDelta().

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items (id) on delete cascade,
  movement_type text not null,
  quantity integer not null,
  quantity_before integer not null,
  quantity_after integer not null,
  reason text,
  reference_type text,
  reference_id text,
  performed_by text not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint inventory_movements_movement_type_check check (
    movement_type in (
      'initial_stock', 'purchase', 'adjustment_increase', 'adjustment_decrease',
      'reservation', 'reservation_release', 'event_checkout', 'event_return',
      'damage', 'loss', 'disposal'
    )
  ),
  constraint inventory_movements_quantity_positive_check check (quantity > 0),
  constraint inventory_movements_quantity_before_check check (quantity_before >= 0),
  constraint inventory_movements_quantity_after_check check (quantity_after >= 0)
);

comment on table public.inventory_movements is
  'Append-only stock-change ledger for inventory_items — never UPDATEd or DELETEd once written. Mirrors src/types/inventoryMovement.ts. See docs/inventory.md''s "Append-only movement history" section.';
