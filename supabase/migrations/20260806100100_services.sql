-- Services migration 2: services table.
--
-- Mirrors src/types/service.ts exactly. This row is the catalog identity
-- only — name/description/category/status. It deliberately holds none of
-- the actual operational content or price; that all lives on ServiceVersion
-- (next migration), scoped via service_version_id. See docs/services.md's
-- "Locked domain decisions" #1: name/description live here, and only here,
-- as the single always-current authoritative source.
--
-- draft_version_id/current_published_version_id reference service_versions,
-- a table created by the NEXT migration — both foreign key constraints are
-- added by that migration (once service_versions exists) rather than here,
-- resolving the circular reference between the two tables. Both stay
-- nullable at the DB layer: draft_version_id is null only in the instant
-- between inserting this row and inserting its paired draft version inside
-- the same create_service transaction (see the RPC migration);
-- current_published_version_id is null until the Service's first publish.
--
-- category_id has no FK to service_categories in this migration either, for
-- the same reason inventory_items.primary_vendor_id originally had none —
-- category assignment is optional and this keeps insert order flexible;
-- the FK is added once both tables exist, in the indexes/constraints
-- migration.
--
-- Soft delete only (archived_at) — status also carries 'archived' as a real
-- member (see core/enums/serviceStatus.ts), matching every other module's
-- shape.

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  category_id uuid,
  name text not null,
  description text,
  status text not null default 'draft',
  draft_version_id uuid,
  current_published_version_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint services_name_not_blank_check check (btrim(name) <> ''),
  constraint services_status_check check (status in ('draft', 'active', 'inactive', 'archived'))
);

comment on table public.services is
  'The catalog identity of a reusable operational unit ("Photography", "Luxury Picnic"). Owns name/description/category/status exclusively — never operational content or price, which lives on service_versions. See docs/services.md.';
