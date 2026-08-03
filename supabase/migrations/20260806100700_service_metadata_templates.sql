-- Services migration 8: operational-metadata template tables —
-- service_seasonal_windows, service_capability_requirements.
--
-- Mirror src/types/serviceSeasonalWindow.ts,
-- serviceCapabilityRequirement.ts exactly. service_capability_requirements
-- was originally designed as two separate, byte-for-byte identical tables
-- (ServiceSkillRequirement/ServiceEquipmentRequirement) — merged into one
-- discriminated table during the pre-migration domain review once the only
-- real difference turned out to be one field name. See docs/services.md's
-- "Locked domain decisions" #8.

create table if not exists public.service_seasonal_windows (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  start_month integer not null,
  end_month integer not null,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_seasonal_windows_start_month_check check (start_month between 1 and 12),
  constraint service_seasonal_windows_end_month_check check (end_month between 1 and 12)
);

comment on table public.service_seasonal_windows is
  'A month range this Service is typically available in — feeds future Reporting seasonality analytics and the AI risk engine. See docs/services.md.';

create table if not exists public.service_capability_requirements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  capability_type text not null,
  label text not null,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_capability_requirements_label_not_blank_check check (btrim(label) <> ''),
  constraint service_capability_requirements_type_check check (capability_type in ('skill', 'equipment')),
  constraint service_capability_requirements_display_order_check check (display_order >= 0)
);

comment on table public.service_capability_requirements is
  'A named staffing skill/certification OR broad equipment/logistics capability a Service typically requires (capability_type discriminates the two). Feeds future Team Operations matching. See docs/services.md.';
