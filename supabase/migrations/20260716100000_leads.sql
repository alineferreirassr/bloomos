-- Leads migration 1 of 4: leads table.
--
-- First business-module table. Mirrors src/types/lead.ts and
-- docs/database.md's `leads` section exactly. Soft delete follows this
-- codebase's established convention (archived_at, never physical delete) —
-- "archived" is also a terminal lifecycle status (core/workflows/leadWorkflow.ts),
-- set together with archived_at by archiveLead(), never reversed in this phase.

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  instagram text,
  source text not null,
  event_type text,
  event_date date,
  location text,
  budget_min numeric,
  budget_max numeric,
  message text,
  status text not null default 'new',
  assigned_to text,
  -- Nullable, no FK: the `clients` table does not exist yet (Clients is a
  -- future migration phase). Populated only by LeadConversionService, which
  -- remains mock-only until then — see docs/integrations.md.
  converted_client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint leads_status_check check (
    status in (
      'new', 'contacted', 'welcome_guide_sent', 'consultation_scheduled',
      'qualified', 'proposal_sent', 'converted', 'lost', 'archived'
    )
  )
);

comment on table public.leads is
  'Inbound prospective clients. Mirrors src/types/lead.ts. Status lifecycle rules live in core/workflows/leadWorkflow.ts, not duplicated here.';

create index if not exists leads_workspace_id_idx on public.leads (workspace_id);
create index if not exists leads_workspace_status_idx on public.leads (workspace_id, status);
create index if not exists leads_workspace_created_at_idx on public.leads (workspace_id, created_at desc);
