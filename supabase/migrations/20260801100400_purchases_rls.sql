-- Purchases migration 5 of 7: RLS enablement + policies for purchases.
--
-- Same shape as vendors_rls.sql/inventory_items_rls.sql: workspace
-- isolation only via is_workspace_member(workspace_id), no owner/admin role
-- gating, no anonymous access, no delete policy — soft delete via
-- archived_at, reversible via restorePurchase(), never a physical DELETE.

alter table public.purchases enable row level security;

create policy "purchases_select_workspace_member"
  on public.purchases for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "purchases_insert_workspace_member"
  on public.purchases for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "purchases_update_workspace_member"
  on public.purchases for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
