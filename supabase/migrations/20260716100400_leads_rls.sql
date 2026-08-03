-- Leads migration 4 of 4b: RLS enablement + policies for leads, notes, and
-- timeline_activities.
--
-- Workspace isolation only, per this phase's spec — no owner/admin role
-- gating on Leads data, unlike workspaces/workspace_members. Any user with
-- an ACTIVE membership in a Workspace (is_workspace_member(), reused from
-- 20260715150500_workspace_membership_helpers.sql) may read and write that
-- Workspace's Leads, notes, and timeline activities. A suspended or invited
-- member fails is_workspace_member() automatically (see that migration).
--
-- No policy here uses a bare `using (true)` — every rule is scoped to the
-- requesting user's actual, active Workspace membership. No delete policy on
-- any of the three tables — this codebase never physically deletes these
-- rows (soft delete via archived_at on leads; notes/timeline_activities are
-- never deleted at all).

alter table public.leads enable row level security;
alter table public.notes enable row level security;
alter table public.timeline_activities enable row level security;

create policy "leads_select_workspace_member"
  on public.leads for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "leads_insert_workspace_member"
  on public.leads for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "leads_update_workspace_member"
  on public.leads for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "notes_select_workspace_member"
  on public.notes for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "notes_insert_workspace_member"
  on public.notes for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "notes_update_workspace_member"
  on public.notes for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "timeline_activities_select_workspace_member"
  on public.timeline_activities for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "timeline_activities_insert_workspace_member"
  on public.timeline_activities for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));
