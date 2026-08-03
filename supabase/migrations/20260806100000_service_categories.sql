-- Services migration 1: service_categories table.
--
-- Mirrors src/types/serviceCategory.ts exactly. Organizational grouping
-- only (Photography, Catering, Entertainment, ...) — carries no operational
-- behavior of its own, matching the domain review's explicit "what should
-- never exist here" answer for this entity.
--
-- Soft delete only (archived_at) — the same convention every other module
-- in this schema follows.

create table if not exists public.service_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint service_categories_name_not_blank_check check (btrim(name) <> ''),
  constraint service_categories_display_order_check check (display_order >= 0)
);

comment on table public.service_categories is
  'Organizational grouping for Services (Photography, Catering, Entertainment, ...). No operational behavior of its own — see docs/services.md.';
