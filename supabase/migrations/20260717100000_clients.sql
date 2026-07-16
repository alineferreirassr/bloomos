-- Clients migration 1 of 6: clients table.
--
-- Second business-module table. Mirrors src/types/client.ts exactly. Soft
-- delete follows this codebase's established convention (archived_at) —
-- unlike Leads, Clients CAN be restored (restoreClient()), so archived_at
-- being set is not a terminal, irreversible state here.
--
-- originating_lead_id is nullable (a Client can be created directly, not
-- just via Lead conversion) and references leads.id — safe to add now since
-- the leads table already exists. The reverse link (leads.converted_client_id
-- -> clients.id) is added in migration 6 of 6, once this table exists.

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  originating_lead_id uuid references public.leads (id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  instagram text,
  preferred_contact_method text,
  partner_name text,
  relationship_status text,
  -- [{id, label, date}], mirrors src/types/client.ts's ClientImportantDate[] —
  -- kept as jsonb rather than a child table since entries have no independent
  -- lifecycle of their own (always read/written as part of the parent Client).
  important_dates jsonb not null default '[]'::jsonb,
  address text,
  city text,
  state text,
  zip_code text,
  source text,
  tags text[] not null default '{}'::text[],
  internal_status text not null default 'active',
  is_returning boolean not null default false,

  how_they_met text,
  first_date date,
  relationship_anniversary date,
  engagement_date date,
  wedding_date date,
  favorite_colors text,
  favorite_flowers text,
  favorite_music text,
  favorite_food text,
  favorite_drinks text,
  preferred_style text,
  disliked_elements text,

  allergies text,
  accessibility_needs text,
  dietary_restrictions text,
  preferred_communication_time text,
  do_not_call boolean not null default false,
  surprise_event_confidentiality boolean not null default false,
  emergency_contact_name text,
  emergency_contact_phone text,
  is_vip boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint clients_internal_status_check check (
    internal_status in ('active', 'planning', 'past_client', 'inactive', 'archived')
  ),
  constraint clients_preferred_contact_method_check check (
    preferred_contact_method is null
    or preferred_contact_method in ('email', 'phone', 'text', 'whatsapp', 'instagram')
  )
);

comment on table public.clients is
  'Converted/direct clients. Mirrors src/types/client.ts. Status lifecycle rules live in core/workflows/clientWorkflow.ts, not duplicated here.';
