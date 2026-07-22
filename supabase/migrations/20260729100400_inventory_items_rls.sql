-- Inventory migration 5 of 7: RLS enablement + policies for
-- inventory_items.
--
-- Exact same workspace-isolation model as clients_rls.sql
-- (20260717100300): Workspace membership only, no owner/admin role gating,
-- no anonymous access, no delete policy (soft-delete via status =
-- 'archived' / archived_at, reversible via restoreInventoryItem(), never a
-- physical DELETE — same mechanism as Clients).

alter table public.inventory_items enable row level security;

create policy "inventory_items_select_workspace_member"
  on public.inventory_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "inventory_items_insert_workspace_member"
  on public.inventory_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "inventory_items_update_workspace_member"
  on public.inventory_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
