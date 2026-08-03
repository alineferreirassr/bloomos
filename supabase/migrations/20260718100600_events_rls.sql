-- Events migration 7 of 8: RLS enablement + policies for events,
-- checklist_items, and event_schedule_items.
--
-- Same shape as leads_rls.sql/clients_rls.sql: Workspace isolation only via
-- is_workspace_member(workspace_id), no owner/admin role gating, no
-- anonymous access. No policy uses a bare `using (true)`.
--
-- events: no delete policy — soft delete via status = 'archived' +
-- archived_at, reversible via restoreEvent(), never a physical DELETE.
--
-- checklist_items/event_schedule_items: DO get a delete policy, since the
-- data layer physically deletes rows here (deleteChecklistItem/
-- deleteScheduleItem) — unlike every other Supabase-backed table so far.
-- The "can't delete a completed checklist item" rule stays an
-- application-level check (same division of responsibility as every other
-- data-layer business rule in this codebase), not a second RLS policy.
--
-- Notes/timeline_activities already have their own Workspace-scoped
-- policies from the Leads migration, which apply unchanged to Event-owned
-- rows now that owner_type = 'event' passes their CHECK constraint
-- (migration 4 of 8) — no new Notes/Timeline policies needed here.

alter table public.events enable row level security;
alter table public.checklist_items enable row level security;
alter table public.event_schedule_items enable row level security;

create policy "events_select_workspace_member"
  on public.events for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "events_insert_workspace_member"
  on public.events for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "events_update_workspace_member"
  on public.events for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "checklist_items_select_workspace_member"
  on public.checklist_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "checklist_items_insert_workspace_member"
  on public.checklist_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "checklist_items_update_workspace_member"
  on public.checklist_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "checklist_items_delete_workspace_member"
  on public.checklist_items for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "event_schedule_items_select_workspace_member"
  on public.event_schedule_items for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "event_schedule_items_insert_workspace_member"
  on public.event_schedule_items for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "event_schedule_items_update_workspace_member"
  on public.event_schedule_items for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "event_schedule_items_delete_workspace_member"
  on public.event_schedule_items for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
