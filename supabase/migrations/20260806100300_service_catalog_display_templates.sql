-- Services migration 4: catalog display template tables —
-- service_included_items, service_addons.
--
-- Both mirror their TS types exactly (src/types/serviceIncludedItem.ts,
-- serviceAddOn.ts). Grouped into one migration since both are simple,
-- closely related "what shows in the catalog listing" content, following
-- the same consolidation judgment call already used for the mock stores —
-- see docs/services.md. Every template table here (and in the following
-- three migrations) is scoped to service_version_id, never service_id
-- directly, and may only be written while its parent version is "draft" —
-- enforced at the DB layer by the immutability triggers migration, not
-- just the application layer (see docs/services.md's "Locked domain
-- decisions" #3).

create table if not exists public.service_included_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  label text not null,
  description text,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_included_items_label_not_blank_check check (btrim(label) <> ''),
  constraint service_included_items_display_order_check check (display_order >= 0)
);

comment on table public.service_included_items is
  'Something included by default with a Service, at no extra price — display-only, generates nothing on assignment. See docs/services.md.';

create table if not exists public.service_addons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  label text not null,
  description text,
  price_delta_minor integer not null default 0,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_addons_label_not_blank_check check (btrim(label) <> ''),
  constraint service_addons_price_delta_minor_check check (price_delta_minor >= 0),
  constraint service_addons_display_order_check check (display_order >= 0)
);

comment on table public.service_addons is
  'An optional paid extra a client can add to a Service booking. price_delta_minor is added to the base price only when selected at assignment time (computeServicePrice). See docs/services.md.';
