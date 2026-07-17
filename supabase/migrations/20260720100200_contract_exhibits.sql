-- Contracts migration 3 of 8: contract_exhibits table.
--
-- A named attachment/appendix to a Contract — model support only, no real
-- file upload in this phase (document_id stays a placeholder null column
-- with no FK yet, exactly like the mock; the future Documents/Media Library
-- integration will populate it later, same pattern as
-- checklist_items/event_schedule_items being generic enough to be reused
-- once relevant modules exist).
--
-- Unlike the polymorphic tables (notes/timeline_activities/checklist_items),
-- contract_exhibits is a true single-parent child of contracts — contract_id
-- is a real, non-polymorphic foreign key, so `on delete cascade` is safe
-- here (contracts themselves are never hard-deleted by the app, but the
-- constraint is correct either way).
--
-- workspace_id is added here even though src/types/contractExhibit.ts's
-- current shape doesn't have it yet — the same redundant-but-required
-- pattern checklist_items/event_schedule_items already use, so RLS can gate
-- purely on workspace_id without a join through contracts. The TS type gets
-- this field added in the same commit (additive, non-breaking).
--
-- Rows here ARE physically deleted (deleteContractExhibit) — the data layer
-- has no completed/locked-item delete guard of its own (locking enforcement
-- is a UI-layer concern here, per the existing code comment), so no delete
-- guard is replicated as a DB constraint, consistent with checklist_items'
-- division of responsibility.

create table if not exists public.contract_exhibits (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  title text not null,
  description text,
  display_order integer not null default 0,
  document_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.contract_exhibits is
  'Named attachments/appendices to a Contract. document_id is a placeholder for the future Media Library integration — always null until that lands. Every query MUST filter by workspace_id together with contract_id.';
