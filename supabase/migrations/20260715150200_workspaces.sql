-- Supabase Foundation — migration 3 of 8: workspaces.
--
-- One row per business operating on BloomOS (BLOOMOS_BIBLE.md §7). The MVP
-- runs a single Workspace (Amoré Bloom — core/constants/workspace.ts), but
-- this table has no cardinality assumption baked in: a user may belong to
-- several, and workspace_members (migration 4) is what enforces that.
-- Archived via archived_at, never physically deleted, matching this
-- codebase's soft-delete convention everywhere else.

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

comment on table public.workspaces is
  'One row per tenant business. The MVP UI assumes exactly one, but the schema supports many per user.';
