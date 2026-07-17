-- Contracts migration 1 of 8: contract_templates table.
--
-- Created before `contracts` (migration 2) even though the user-facing
-- ordering lists contracts first — contracts.template_id references this
-- table, so it must exist first. Mirrors src/types/contractTemplate.ts
-- exactly. Workspace-scoped (each Workspace has its own templates, never a
-- shared global library) — "reusable across every Workspace" in the type's
-- doc comment means the *shape* is reusable, not that rows are shared.
--
-- Read-only in this phase — no createContractTemplate/updateContractTemplate
-- exists in the current public API ("No editor yet", per the type's doc
-- comment), so this migration intentionally does not seed any rows; RLS
-- (migration 7) grants select only, no insert/update/delete, matching that
-- exact absence of a write path today.

create table if not exists public.contract_templates (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  category text not null,
  body text not null,
  version integer not null default 1,
  active boolean not null default true,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint contract_templates_category_check check (
    category in (
      'event_agreement', 'vendor_agreement', 'rental_agreement',
      'photography_release', 'venue_rental', 'custom', 'other'
    )
  )
);

comment on table public.contract_templates is
  'Reusable, workspace-scoped contract bodies a Contract can be created from (contracts.template_id). Read-only in this phase — no app-level create/update path exists yet.';
