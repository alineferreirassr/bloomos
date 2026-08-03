-- Vendors migration 4 of 5: RLS enablement + policies.
--
-- Exact same workspace-isolation model as clients_rls.sql
-- (20260717100300): Workspace membership only, no owner/admin role
-- gating, no anonymous access, no delete policy (soft-delete via
-- archived_at, reversible, never a physical DELETE — same mechanism as
-- Clients/Inventory).

alter table public.vendors enable row level security;

create policy "vendors_select_workspace_member"
  on public.vendors for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "vendors_insert_workspace_member"
  on public.vendors for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "vendors_update_workspace_member"
  on public.vendors for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
