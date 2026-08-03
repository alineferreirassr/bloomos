-- Clients migration 4 of 6: RLS enablement + policies for clients.
--
-- Same shape as leads_rls.sql: Workspace isolation only, no owner/admin role
-- gating, no anonymous access, no delete policy (Clients use soft-delete via
-- internal_status = 'archived' / archived_at, with restoreClient() reversing
-- it — never a physical DELETE). Notes and timeline_activities already have
-- their own Workspace-scoped policies from the Leads migration, which apply
-- unchanged to Client-owned rows now that owner_type = 'client' passes their
-- CHECK constraints (migration 2 of 6) — no new Notes/Timeline policies
-- needed here.

alter table public.clients enable row level security;

create policy "clients_select_workspace_member"
  on public.clients for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "clients_insert_workspace_member"
  on public.clients for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "clients_update_workspace_member"
  on public.clients for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
