-- Inventory migration 1 of 7: inventory_items table.
--
-- Mirrors src/types/inventoryItem.ts exactly. Covers both `consumable`
-- items (bought once, used up — condition is always null) and `reusable`
-- items (bought once, checked out/returned across many Events — condition
-- is one of 7 values or null when not yet assessed).
--
-- Money fields (unit_cost/replacement_cost/rental_value) are integer minor
-- units (cents), matching the Finance tables' established convention — no
-- float column anywhere in this table.
--
-- quantity_on_hand/quantity_available/quantity_reserved are never written
-- to directly by the application outside of movement application (see
-- inventory_movements below) — the CHECK constraints here are a second,
-- database-level enforcement of the same invariants src/core/workflows/
-- inventoryWorkflow.ts already enforces at the application layer.
--
-- primary_vendor_id is a plain uuid with no FK — the Vendors module and its
-- table don't exist yet; this column is reserved exactly like
-- clients.originating_lead_id was reserved ahead of the Leads table
-- existing, except here the referenced table itself is still future work.
--
-- Soft delete only (archived_at) — no deleted_at, matching the dominant
-- BloomOS convention (Client/Lead/Event/Contract/Invoice/Payment/Expense
-- all use archived_at alone); archiveInventoryItem()/restoreInventoryItem()
-- is the only way in or out of the archived state, never a physical DELETE.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  sku text,
  category text,
  subcategory text,
  item_type text not null,

  tags text[] not null default '{}'::text[],
  status text not null default 'active',
  condition text,
  unit_of_measure text,

  quantity_on_hand integer not null default 0,
  quantity_available integer not null default 0,
  quantity_reserved integer not null default 0,
  reorder_level integer,
  target_stock_level integer,

  unit_cost integer,
  replacement_cost integer,
  rental_value integer,

  storage_location text,
  bin_location text,

  primary_vendor_id uuid,
  purchase_date date,
  last_inventory_check_at timestamptz,
  notes text,
  image_url text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint inventory_items_item_type_check check (item_type in ('consumable', 'reusable')),
  constraint inventory_items_status_check check (status in ('active', 'inactive', 'archived')),
  constraint inventory_items_condition_check check (
    condition is null
    or condition in ('new', 'excellent', 'good', 'fair', 'damaged', 'under_repair', 'retired')
  ),
  -- Mirrors isConditionValidForItemType() (core/workflows/inventoryWorkflow.ts):
  -- a consumable item is used up, never physically assessed.
  constraint inventory_items_condition_matches_item_type_check check (
    item_type <> 'consumable' or condition is null
  ),

  constraint inventory_items_quantity_on_hand_check check (quantity_on_hand >= 0),
  constraint inventory_items_quantity_available_non_negative_check check (quantity_available >= 0),
  constraint inventory_items_quantity_reserved_non_negative_check check (quantity_reserved >= 0),
  constraint inventory_items_quantity_available_check check (quantity_available <= quantity_on_hand),
  constraint inventory_items_quantity_reserved_check check (quantity_reserved <= quantity_on_hand),

  constraint inventory_items_reorder_level_check check (reorder_level is null or reorder_level >= 0),
  constraint inventory_items_target_stock_level_check check (target_stock_level is null or target_stock_level >= 0),
  constraint inventory_items_unit_cost_check check (unit_cost is null or unit_cost >= 0),
  constraint inventory_items_replacement_cost_check check (replacement_cost is null or replacement_cost >= 0),
  constraint inventory_items_rental_value_check check (rental_value is null or rental_value >= 0)
);

comment on table public.inventory_items is
  'Physical/reusable assets used to produce Events. Mirrors src/types/inventoryItem.ts. Quantities change only via inventory_movements rows, never a direct UPDATE of quantity_on_hand from application code — see docs/inventory.md.';
