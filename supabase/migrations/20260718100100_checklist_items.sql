-- Events migration 2 of 8: checklist_items table.
--
-- Polymorphic (owner_type + owner_id), reusable across owner types the same
-- way notes/timeline_activities are — mirrors src/types/checklistItem.ts
-- exactly. Only owner_type = 'event' is populated today; widening this CHECK
-- constraint is a future module's own migration phase, exactly like
-- notes/timeline_activities.
--
-- Unlike notes/timeline_activities, rows here ARE physically deleted
-- (deleteChecklistItem) — the data layer already refuses to delete a
-- completed item (application-level business rule, not replicated as a DB
-- constraint here, same division of responsibility as every other
-- data-layer validation in this codebase).

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  title text not null,
  description text,
  category text not null,
  priority text not null,
  status text not null default 'pending',
  due_date date,
  completed_at timestamptz,
  assigned_type text not null default 'unknown',
  assigned_id uuid,
  assigned_name text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checklist_items_owner_type_check check (owner_type in ('event')),
  constraint checklist_items_category_check check (
    category in (
      'planning', 'client', 'venue', 'decor', 'flowers', 'photography', 'video', 'food_beverage',
      'transportation', 'team', 'inventory', 'finance', 'legal', 'weather', 'setup', 'cleanup',
      'post_event', 'other'
    )
  ),
  constraint checklist_items_priority_check check (priority in ('low', 'normal', 'high', 'critical')),
  constraint checklist_items_status_check check (
    status in ('pending', 'in_progress', 'blocked', 'completed', 'cancelled')
  ),
  constraint checklist_items_assigned_type_check check (
    assigned_type in ('employee', 'vendor', 'client', 'unknown')
  )
);

comment on table public.checklist_items is
  'Polymorphic checklist items shared across owner types (owner_type + owner_id) — only owner_type = event is live. Every query MUST filter by workspace_id together with owner_type/owner_id, never owner_id alone — see docs/database.md.';
