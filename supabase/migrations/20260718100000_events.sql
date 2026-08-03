-- Events migration 1 of 8: events table.
--
-- Third business-module table. Mirrors src/types/event.ts exactly. status
-- and lifecycle_stage are two independent state machines (see
-- core/workflows/eventWorkflow.ts) — neither is inferred from the other, and
-- neither CHECK constraint below encodes a transition rule (that stays
-- application logic, exactly like leads.status).
--
-- client_id is NOT NULL — an Event cannot exist without a Client, the same
-- business rule already enforced in the mock data layer (createEvent/
-- updateEvent both reject a missing/invalid client_id). Soft delete follows
-- this codebase's convention (archived_at) — like Clients (not Leads),
-- archived is reversible via restoreEvent().
--
-- start_time/end_time are stored as plain text ("HH:MM"), not a Postgres
-- `time` type — the app already does its own lexicographic HH:MM string
-- comparison (see eventFormSchema's end-time-after-start-time refine) and
-- expects to read back exactly the string it wrote; a `time` column would
-- round-trip through Postgres's own time formatting instead.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  client_id uuid not null references public.clients (id),
  originating_lead_id uuid references public.leads (id) on delete set null,
  title text not null,
  event_type text not null,
  status text not null default 'draft',
  lifecycle_stage text not null default 'intake',
  event_date date,
  start_time text,
  end_time text,
  timezone text,
  location_name text,
  address text,
  city text,
  state text,
  zip_code text,
  latitude numeric,
  longitude numeric,
  guest_count integer,
  budget_min numeric,
  budget_max numeric,
  package_name text,
  theme text,
  color_palette text,
  surprise_event boolean not null default false,
  confidentiality_notes text,
  accessibility_notes text,
  dietary_notes text,
  weather_plan text,
  backup_location text,
  internal_summary text,
  assigned_owner text,
  priority text not null default 'normal',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,

  constraint events_event_type_check check (
    event_type in (
      'proposal', 'anniversary', 'birthday', 'picnic', 'hotel_decoration', 'romantic_setup',
      'private_dinner', 'engagement', 'micro_wedding', 'bridal_shower', 'baby_shower', 'elopement',
      'styled_shoot', 'branding', 'photoshoot', 'other'
    )
  ),
  constraint events_status_check check (
    status in (
      'draft', 'inquiry', 'awaiting_contract', 'awaiting_deposit', 'confirmed', 'planning',
      'ready', 'in_progress', 'completed', 'cancelled', 'archived'
    )
  ),
  constraint events_lifecycle_stage_check check (
    lifecycle_stage in (
      'intake', 'proposal', 'booking', 'planning', 'preparation', 'setup', 'execution',
      'live_event', 'breakdown', 'post_event', 'closed'
    )
  ),
  constraint events_priority_check check (priority in ('low', 'normal', 'high', 'urgent', 'critical'))
);

comment on table public.events is
  'The operational center of BloomOS — ties a Client to a specific engagement. Mirrors src/types/event.ts. Lifecycle rules live in core/workflows/eventWorkflow.ts, not duplicated here.';
