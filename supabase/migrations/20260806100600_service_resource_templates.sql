-- Services migration 7: resource template tables —
-- service_inventory_template_items, service_purchase_template_items,
-- service_vendor_suggestions, service_team_role_requirements.
--
-- Mirror src/types/serviceInventoryTemplateItem.ts,
-- servicePurchaseTemplateItem.ts, serviceVendorSuggestion.ts,
-- serviceTeamRoleRequirement.ts exactly. inventory_item_id/
-- typical_vendor_id are nullable with `on delete set null` — a template
-- can name a specific real item/vendor, or just describe what's needed by
-- name alone, the same "reserve the nullable reference" shape
-- inventory_items.primary_vendor_id already established. vendor_id on
-- service_vendor_suggestions is a real, required foreign key (a
-- suggestion is inherently about one specific real Vendor).
--
-- A `resource_package_id` alternative on service_inventory_template_items
-- (so one row can expand to many Inventory items via a reusable Resource
-- Package) is a Phase 2c addition, not modeled here.

create table if not exists public.service_inventory_template_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  inventory_item_id uuid references public.inventory_items (id) on delete set null,
  item_name text not null,
  quantity integer not null default 1,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_inventory_template_items_item_name_not_blank_check check (btrim(item_name) <> ''),
  constraint service_inventory_template_items_quantity_check check (quantity > 0),
  constraint service_inventory_template_items_display_order_check check (display_order >= 0)
);

comment on table public.service_inventory_template_items is
  'What Inventory a Service typically needs. Never decrements real Inventory quantities itself — see event_service_inventory_requirements for the generated, human-fulfilled instance this produces on assignment. See docs/services.md.';

create table if not exists public.service_purchase_template_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  item_name text not null,
  estimated_unit_cost_minor integer not null default 0,
  estimated_quantity integer not null default 1,
  typical_vendor_id uuid references public.vendors (id) on delete set null,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_purchase_template_items_item_name_not_blank_check check (btrim(item_name) <> ''),
  constraint service_purchase_template_items_estimated_unit_cost_check check (estimated_unit_cost_minor >= 0),
  constraint service_purchase_template_items_estimated_quantity_check check (estimated_quantity > 0),
  constraint service_purchase_template_items_display_order_check check (display_order >= 0)
);

comment on table public.service_purchase_template_items is
  'What''s typically purchased for a Service — a draft a human reviews and turns into a real Purchase through the existing New Purchase flow; never creates a real Purchase automatically. See docs/services.md.';

create table if not exists public.service_vendor_suggestions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  vendor_id uuid not null references public.vendors (id),
  note text,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_vendor_suggestions_display_order_check check (display_order >= 0)
);

comment on table public.service_vendor_suggestions is
  'A recommended real Vendor for this Service — generates an unconfirmed event_service_vendor_assignments row on assignment; a human still confirms which, if any, suggestion is actually used. See docs/services.md.';

create table if not exists public.service_team_role_requirements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  service_version_id uuid not null references public.service_versions (id) on delete cascade,
  role_label text not null,
  quantity integer not null default 1,
  note text,
  display_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint service_team_role_requirements_role_label_not_blank_check check (btrim(role_label) <> ''),
  constraint service_team_role_requirements_quantity_check check (quantity > 0),
  constraint service_team_role_requirements_display_order_check check (display_order >= 0)
);

comment on table public.service_team_role_requirements is
  'A staffing role a Service typically needs. Generates an event_service_team_requirements row with no real person assigned yet — populated once Team Operations exists. See docs/services.md.';
