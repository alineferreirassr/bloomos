-- Services migration 6: readiness template tables —
-- service_approval_template_items, service_travel_template_items,
-- service_required_documents, service_ai_knowledge_items.
--
-- Mirror src/types/serviceApprovalTemplateItem.ts,
-- serviceTravelTemplateItem.ts, serviceRequiredDocument.ts,
-- serviceAiKnowledgeItem.ts exactly. service_ai_knowledge_items is data for
-- Bloom AI to narrate, never a prompt instruction — matches docs/ai.md's
-- "data-grounded, not speculative" guardrail exactly.

create table if not exists public.service_approval_template_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  label text not null,
  description text,
  days_before_event_deadline integer,
  required_role text,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_approval_template_items_label_not_blank_check check (btrim(label) <> ''),
  constraint service_approval_template_items_days_before_check check (days_before_event_deadline is null or days_before_event_deadline >= 0),
  constraint service_approval_template_items_display_order_check check (display_order >= 0)
);

comment on table public.service_approval_template_items is
  'A named approval checkpoint a Service typically needs before its Event date. required_role is free text — no Team Operations role model exists yet to reference. See docs/services.md.';

create table if not exists public.service_travel_template_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  label text not null,
  description text,
  requires_equipment_transport boolean not null default false,
  drive_time_buffer_minutes integer,
  mileage_estimate numeric,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_travel_template_items_label_not_blank_check check (btrim(label) <> ''),
  constraint service_travel_template_items_drive_time_buffer_check check (drive_time_buffer_minutes is null or drive_time_buffer_minutes >= 0),
  constraint service_travel_template_items_mileage_estimate_check check (mileage_estimate is null or mileage_estimate >= 0),
  constraint service_travel_template_items_display_order_check check (display_order >= 0)
);

comment on table public.service_travel_template_items is
  'A travel/logistics requirement a Service typically carries — a forward-looking hook for the future Team Travel Mode roadmap step, not consumed by anything yet. See docs/services.md.';

create table if not exists public.service_required_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  label text not null,
  category text,
  is_required boolean not null default false,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_required_documents_label_not_blank_check check (btrim(label) <> ''),
  constraint service_required_documents_display_order_check check (display_order >= 0)
);

comment on table public.service_required_documents is
  'A document TYPE a Service typically requires — not a real Document row, just a reusable requirement label. See docs/services.md.';

create table if not exists public.service_ai_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  knowledge_type text not null,
  content text not null,
  severity text not null default 'medium',
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_ai_knowledge_items_content_not_blank_check check (btrim(content) <> ''),
  constraint service_ai_knowledge_items_type_check check (
    knowledge_type in ('common_mistake', 'best_practice', 'typical_delay', 'safety_reminder', 'important_observation')
  ),
  constraint service_ai_knowledge_items_severity_check check (severity in ('low', 'medium', 'high')),
  constraint service_ai_knowledge_items_display_order_check check (display_order >= 0)
);

comment on table public.service_ai_knowledge_items is
  'Structured operational knowledge for Bloom AI to narrate — data, never a prompt instruction. severity lets a future prompt-assembly step avoid dumping every entry from every assigned Service into one brief. See docs/services.md.';
