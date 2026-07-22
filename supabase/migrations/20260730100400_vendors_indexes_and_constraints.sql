-- Vendors migration 5 of 5: indexes and constraints.
--
-- Mirrors the query patterns every other directory-style table already
-- needs: list-by-workspace, filter by status, filter by preferred vendors
-- (partial index, same shape as clients_workspace_vip_idx), tag search
-- (gin, same shape as clients_tags_gin_idx/inventory_items_tags_gin_idx),
-- and workspace-scoped tax_id uniqueness allowing repeated nulls (same
-- partial-unique-index shape as inventory_items_workspace_sku_unique —
-- `where tax_id is not null` is what makes this correct for an optional
-- field: any number of rows with tax_id = null are excluded from the
-- uniqueness check entirely, while two non-null tax IDs in the same
-- workspace do collide, and the same tax_id in a different workspace
-- never does).

create index if not exists vendors_workspace_id_idx on public.vendors (workspace_id);
create index if not exists vendors_workspace_status_idx on public.vendors (workspace_id, status);
create index if not exists vendors_workspace_preferred_idx
  on public.vendors (workspace_id, is_preferred) where is_preferred = true;
create index if not exists vendors_tags_gin_idx on public.vendors using gin (tags);

create unique index if not exists vendors_workspace_tax_id_unique
  on public.vendors (workspace_id, tax_id) where tax_id is not null;
