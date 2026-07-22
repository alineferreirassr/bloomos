-- Inventory migration 6 of 7: RLS enablement + policies for
-- inventory_movements.
--
-- Same workspace-isolation model as every other table, but with only
-- select/insert policies — no update, no delete. RLS is default-deny per
-- operation when no policy exists for it, so omitting update/delete
-- policies entirely is what makes this table append-only at the database
-- layer, not just at the application layer (InventoryRepository has no
-- update/delete method either — see docs/inventory.md).

alter table public.inventory_movements enable row level security;

create policy "inventory_movements_select_workspace_member"
  on public.inventory_movements for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "inventory_movements_insert_workspace_member"
  on public.inventory_movements for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));
