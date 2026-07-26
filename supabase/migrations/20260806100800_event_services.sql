-- Services migration 9: event_services table — the Instance layer.
--
-- Mirrors src/types/eventService.ts exactly. One Service assigned to one
-- Event. service_id stays for "what kind of Service is this, generally"
-- grouping/reporting; service_version_id is the real pin — permanent,
-- never changes even after the catalog Service publishes v2, v3, v4.
--
-- name/price_minor are this booking's live, possibly-overridden values;
-- name_template_value/price_template_value are frozen copies of exactly
-- what the pinned ServiceVersion said at assignment time (price includes
-- any selected_add_on_ids chosen then) — the baseline the Event Override
-- mechanism compares against. See docs/services.md's Snapshot Review:
-- these exist for override support, not to protect against a version
-- changing (a published version already cannot change).
--
-- Generated exclusively by the assign_service_to_event RPC (later
-- migration), in the same transaction as every child table below and the
-- real checklist_items/event_schedule_items rows it tags.

create table if not exists public.event_services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  event_id uuid not null references public.events (id) on delete cascade,
  service_id uuid not null references public.services (id),
  service_version_id uuid not null references public.service_versions (id),
  name text not null,
  name_template_value text not null,
  price_minor integer not null default 0,
  price_template_value integer not null default 0,
  currency text not null default 'USD',
  selected_add_on_ids uuid[] not null default '{}',
  status text not null default 'proposed',
  assigned_at timestamptz not null default now(),
  assigned_by text not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint event_services_name_not_blank_check check (btrim(name) <> ''),
  constraint event_services_price_minor_check check (price_minor >= 0),
  constraint event_services_price_template_value_check check (price_template_value >= 0),
  constraint event_services_currency_check check (char_length(currency) = 3),
  constraint event_services_status_check check (status in ('proposed', 'confirmed', 'in_progress', 'completed', 'cancelled'))
);

comment on table public.event_services is
  'One Service booked on one Event, pinned to an immutable service_version_id forever. No uniqueness constraint on (event_id, service_id) — booking the same Service twice on one Event (e.g. two separate Photography sessions) is a supported, deliberate decision. See docs/services.md.';
