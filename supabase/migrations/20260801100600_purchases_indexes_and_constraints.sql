-- Purchases migration 7 of 7: indexes and constraints.
--
-- purchase_number uniqueness is workspace-scoped and NOT partial (unlike
-- vendors_workspace_tax_id_unique/inventory_items_workspace_sku_unique,
-- which exclude nulls for an optional column) — purchase_number is a
-- required, always-populated column, so this mirrors
-- invoices_workspace_number_unique/contracts_workspace_number_unique
-- exactly: every row, including archived ones, participates in the
-- uniqueness check, so an archived Purchase's number can never be reused
-- within the same workspace.
--
-- The unique index on (workspace_id, purchase_number) already covers
-- workspace-scoped purchase_number lookups, so no separate plain index for
-- that column pair is added — avoiding the redundancy the Vendors/
-- Inventory index migrations were already careful to avoid.

create index if not exists purchases_workspace_id_idx on public.purchases (workspace_id);
create index if not exists purchases_workspace_vendor_idx on public.purchases (workspace_id, vendor_id);
create index if not exists purchases_workspace_status_idx on public.purchases (workspace_id, status);
create index if not exists purchases_workspace_order_date_idx on public.purchases (workspace_id, order_date);
create index if not exists purchases_workspace_expected_delivery_date_idx
  on public.purchases (workspace_id, expected_delivery_date);
create index if not exists purchases_workspace_archived_at_idx on public.purchases (workspace_id, archived_at);

create unique index if not exists purchases_workspace_number_unique
  on public.purchases (workspace_id, purchase_number);

create index if not exists purchase_items_workspace_id_idx on public.purchase_items (workspace_id);
create index if not exists purchase_items_purchase_id_idx on public.purchase_items (purchase_id);
create index if not exists purchase_items_inventory_item_id_idx on public.purchase_items (inventory_item_id);
create index if not exists purchase_items_purchase_id_display_order_idx
  on public.purchase_items (purchase_id, display_order);
