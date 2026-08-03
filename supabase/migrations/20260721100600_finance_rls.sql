-- Finance migration 7 of 8: RLS enablement + policies for invoices,
-- payments, and expenses.
--
-- Same shape as every previous business-module RLS migration: Workspace
-- isolation only via is_workspace_member(workspace_id), no owner/admin role
-- gating, no anonymous access. No policy uses a bare `using (true)`.
--
-- No delete policy on any of the three tables — all financial records are
-- soft-deleted/reversible (Invoice/Expense via archived_at + restore*;
-- Payment has no archive concept at all, but is equally never physically
-- deleted — a Payment's history must be permanent for an accurate audit
-- trail, cancelled/failed/refunded are just terminal statuses, not
-- deletions). This is a hard requirement, not just a convention: financial
-- records are never hard-deleted by this app.

alter table public.invoices enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;

create policy "invoices_select_workspace_member"
  on public.invoices for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "invoices_insert_workspace_member"
  on public.invoices for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "invoices_update_workspace_member"
  on public.invoices for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "payments_select_workspace_member"
  on public.payments for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "payments_insert_workspace_member"
  on public.payments for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "payments_update_workspace_member"
  on public.payments for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "expenses_select_workspace_member"
  on public.expenses for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "expenses_insert_workspace_member"
  on public.expenses for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "expenses_update_workspace_member"
  on public.expenses for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
