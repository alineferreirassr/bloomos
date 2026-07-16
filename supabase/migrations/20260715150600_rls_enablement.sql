-- Supabase Foundation — migration 7 of 8: RLS enablement + policies.
--
-- Principles enforced below (docs/permissions.md):
--   - users may read/update only their own profile;
--   - Workspace members may read their Workspace;
--   - only owner/admin may update Workspace settings;
--   - members may read membership rows for Workspaces they belong to;
--   - only owner/admin may manage memberships;
--   - suspended members must not access Workspace data (enforced inside
--     is_workspace_member()/has_workspace_role() — status = 'active' only);
--   - no anonymous access — every policy below is scoped `to authenticated`
--     in addition to checking auth.uid(), which is null for anon requests.
-- No policy here uses a bare `using (true)` — every rule is scoped to the
-- requesting user's own row or their actual Workspace membership.

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;

-- profiles: a user manages only their own profile row. No insert/delete
-- policy — rows are created only by handle_new_user() (security definer,
-- migration 2) and never removed while the auth.users row exists.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- workspaces: any active member may read; only owner/admin may update.
-- No delete policy — archival is via archived_at, not physical delete.
-- No insert policy this phase — the first owner/admin account and its
-- Workspace are created manually via the Supabase Dashboard/SQL, not
-- through an app-facing signup flow (see docs/permissions.md).
create policy "workspaces_select_member"
  on public.workspaces for select
  to authenticated
  using (public.is_workspace_member(id));

create policy "workspaces_update_owner_admin"
  on public.workspaces for update
  to authenticated
  using (public.has_workspace_role(id, array['owner', 'admin']))
  with check (public.has_workspace_role(id, array['owner', 'admin']));

-- workspace_members: any active member may read membership rows for a
-- Workspace they belong to (so the team roster is visible to the whole
-- team, not just owner/admin); only owner/admin may insert/update/delete
-- memberships.
create policy "workspace_members_select_fellow_member"
  on public.workspace_members for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "workspace_members_insert_owner_admin"
  on public.workspace_members for insert
  to authenticated
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_update_owner_admin"
  on public.workspace_members for update
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']))
  with check (public.has_workspace_role(workspace_id, array['owner', 'admin']));

create policy "workspace_members_delete_owner_admin"
  on public.workspace_members for delete
  to authenticated
  using (public.has_workspace_role(workspace_id, array['owner', 'admin']));
