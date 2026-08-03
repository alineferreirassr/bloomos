-- Events migration 6 of 8: indexes and constraints.
--
-- Mirrors the query patterns getEvents()/getChecklistByEventId()/
-- getScheduleByEventId()/the dashboard metrics actually use: list-by-workspace,
-- filter by status/client/date range, sort by created_at, and the
-- workspace_id+owner_type+owner_id scoping every polymorphic read uses.

create index if not exists events_workspace_id_idx on public.events (workspace_id);
create index if not exists events_workspace_status_idx on public.events (workspace_id, status);
create index if not exists events_workspace_event_date_idx on public.events (workspace_id, event_date);
create index if not exists events_client_id_idx on public.events (client_id);

create index if not exists checklist_items_workspace_owner_idx
  on public.checklist_items (workspace_id, owner_type, owner_id);
create index if not exists checklist_items_workspace_owner_sort_idx
  on public.checklist_items (workspace_id, owner_type, owner_id, sort_order);
create index if not exists checklist_items_due_date_idx on public.checklist_items (due_date) where due_date is not null;

create index if not exists event_schedule_items_workspace_owner_idx
  on public.event_schedule_items (workspace_id, owner_type, owner_id);
create index if not exists event_schedule_items_workspace_owner_sort_idx
  on public.event_schedule_items (workspace_id, owner_type, owner_id, sort_order);
