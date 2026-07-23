-- Purchases migration 6 of 7: RLS enablement + policies for purchase_items.
--
-- purchase_items DOES get a delete policy, since removePurchaseItem
-- physically deletes rows — same precedent as contract_exhibits. No
-- draft-only/zero-received guard here either; that stays a repository-layer
-- concern (see purchase_items.sql's own comment and
-- lib/data/purchases/repository.ts), matching contract_exhibits' identical
-- division of responsibility.
--
-- workspace_id is gated on directly (not via a join through purchases),
-- exactly like contract_exhibits — since workspace_id is always written to
-- match the parent Purchase's own workspace_id, a purchase_items row can
-- never be read or written outside its parent Purchase's workspace.

alter table public.purchase_items enable row level security;

create policy "purchase_items_select_workspace_member"
  on public.purchase_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "purchase_items_insert_workspace_member"
  on public.purchase_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "purchase_items_update_workspace_member"
  on public.purchase_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "purchase_items_delete_workspace_member"
  on public.purchase_items for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
