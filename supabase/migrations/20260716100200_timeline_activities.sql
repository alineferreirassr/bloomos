-- Leads migration 3 of 4: timeline_activities table.
--
-- Shared, polymorphic, append-only table (owner_type + owner_id) — mirrors
-- src/types/timelineActivity.ts and the mock timelineStore's architecture
-- exactly (docs/database.md's `timeline_activities` section). No updated_at:
-- every entry is immutable once written, recorded through one shared
-- mechanism, never edited. Same owner_id/no-FK rationale as notes above.
--
-- owner_type and type are both constrained to the Leads-only subset this
-- migration needs. Each future module's own migration phase must widen both
-- CHECK constraints when it adds real Supabase-backed activity — exactly as
-- core/enums/timelineActivityType.ts grew incrementally per mock-phase.

create table if not exists public.timeline_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  owner_type text not null,
  owner_id uuid not null,
  type text not null,
  description text not null,
  actor text not null,
  "timestamp" timestamptz not null default now(),
  metadata jsonb,
  constraint timeline_activities_owner_type_check check (owner_type in ('lead')),
  constraint timeline_activities_type_check check (
    type in (
      'lead_created', 'lead_updated', 'status_changed', 'note_added',
      'note_pinned', 'note_unpinned', 'welcome_guide_sent', 'lead_archived'
    )
  )
);

comment on table public.timeline_activities is
  'Polymorphic, append-only activity log shared across owner types (owner_type + owner_id). Every query MUST filter by workspace_id together with owner_type/owner_id, never owner_id alone — see docs/database.md.';

create index if not exists timeline_activities_workspace_owner_idx
  on public.timeline_activities (workspace_id, owner_type, owner_id);
create index if not exists timeline_activities_workspace_owner_timestamp_idx
  on public.timeline_activities (workspace_id, owner_type, owner_id, "timestamp" desc);
