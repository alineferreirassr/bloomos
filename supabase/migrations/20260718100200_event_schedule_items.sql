-- Events migration 3 of 8: event_schedule_items table.
--
-- Polymorphic (owner_type + owner_id), generalized the same way as
-- checklist_items — mirrors src/types/eventScheduleItem.ts exactly. Only
-- owner_type = 'event' is populated today. Named `event_schedule_items`
-- (not `schedule_items`, the mock store/docs' existing name) to avoid ever
-- colliding with a future generic `schedule_items` table if one is needed
-- for a non-Event owner; the TS domain type stays `EventScheduleItem` and
-- the mock store stays `scheduleStore.ts` unchanged.
--
-- start_time/end_time are stored as plain text, same rationale as
-- events.start_time/end_time in the previous migration.
--
-- Like checklist_items, rows here ARE physically deleted (deleteScheduleItem)
-- — no soft-delete/business-rule restriction exists in the data layer for
-- schedule items (unlike checklist items' completed-item delete guard).

create table if not exists public.event_schedule_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  title text not null,
  description text,
  start_time text,
  end_time text,
  location text,
  assigned_to text,
  category text not null,
  status text not null default 'planned',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_schedule_items_owner_type_check check (owner_type in ('event')),
  constraint event_schedule_items_category_check check (
    category in (
      'arrival', 'delivery', 'setup', 'vendor', 'client', 'surprise', 'ceremony', 'photography',
      'video', 'food_beverage', 'cleanup', 'departure', 'other'
    )
  ),
  constraint event_schedule_items_status_check check (
    status in ('planned', 'confirmed', 'completed', 'delayed', 'cancelled')
  )
);

comment on table public.event_schedule_items is
  'Polymorphic day-of schedule items shared across owner types (owner_type + owner_id) — only owner_type = event is live. Every query MUST filter by workspace_id together with owner_type/owner_id, never owner_id alone — see docs/database.md.';
