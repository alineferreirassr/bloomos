-- Inventory migration 7 of 7: indexes and constraints.
--
-- Mirrors the query patterns lib/data/inventory/mockRepository.ts already
-- uses (the shape a Supabase implementation will need identically):
-- list-by-workspace, filter by status/item_type/condition, tag search,
-- the low-stock candidate scan (reorder_level is not null), and movement
-- history looked up by inventory_item_id ordered by occurred_at desc —
-- same two-index shape timeline_activities already uses for its own
-- workspace+owner+timestamp lookup.
--
-- inventory_items_workspace_sku_unique is a partial unique index, not a
-- bare `unique (workspace_id, sku)` table constraint — same pattern as
-- media_assets_bucket_path_unique/contracts_workspace_number_unique/
-- invoices_workspace_number_unique/the pending-invitation uniqueness
-- indexes. `where sku is not null` is what makes this correct for an
-- optional field: any number of rows with sku = null are excluded from the
-- uniqueness check entirely (so they never collide with each other),
-- while two non-null SKUs in the same workspace do collide, and the same
-- SKU in a different workspace never does (workspace_id is part of the
-- indexed key).

create index if not exists inventory_items_workspace_id_idx on public.inventory_items (workspace_id);
create index if not exists inventory_items_workspace_status_idx on public.inventory_items (workspace_id, status);
create index if not exists inventory_items_workspace_item_type_idx on public.inventory_items (workspace_id, item_type);
create index if not exists inventory_items_workspace_category_idx on public.inventory_items (workspace_id, category);
create index if not exists inventory_items_workspace_condition_idx on public.inventory_items (workspace_id, condition);
create index if not exists inventory_items_workspace_reorder_level_idx
  on public.inventory_items (workspace_id) where reorder_level is not null;
create index if not exists inventory_items_tags_gin_idx on public.inventory_items using gin (tags);

create unique index if not exists inventory_items_workspace_sku_unique
  on public.inventory_items (workspace_id, sku) where sku is not null;

create index if not exists inventory_movements_workspace_item_idx
  on public.inventory_movements (workspace_id, inventory_item_id);
create index if not exists inventory_movements_workspace_item_occurred_at_idx
  on public.inventory_movements (workspace_id, inventory_item_id, occurred_at desc);
