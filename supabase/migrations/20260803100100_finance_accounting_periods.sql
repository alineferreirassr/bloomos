-- Finance Database migration 2 of 11: accounting_periods table.
--
-- Created before journal_entries (migration 3) since every Journal Entry
-- requires a non-null accounting_period_id — the same "parent before child
-- FK" ordering discipline every prior module's migration set already
-- follows.
--
-- No overlap-prevention EXCLUDE constraint is added inline here — like
-- chart_of_accounts' uniqueness index, it lives in the dedicated indexes
-- migration (10 of 11), keeping every migration in this set focused on one
-- kind of change.
--
-- status has exactly three states (open/closed/locked), one-directional in
-- practice (open -> closed -> locked): closing/locking are performed by
-- future close_period/lock_period RPCs, not implemented in this
-- database-only phase. No RPC exists yet to actually transition a period —
-- this table intentionally has no default row and starts empty; nothing in
-- the existing app creates or depends on a period today.

create table if not exists public.accounting_periods (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  status text not null default 'open',
  closed_at timestamptz,
  closed_by text,
  locked_at timestamptz,
  locked_by text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint accounting_periods_status_check check (status in ('open', 'closed', 'locked')),
  constraint accounting_periods_date_range_check check (period_end > period_start)
);

comment on table public.accounting_periods is
  'Workspace-scoped accounting periods (month or custom range) that every Journal Entry belongs to. Closing/locking is performed by future close_period/lock_period RPCs (Posting Engine phase, not yet implemented) — this migration only establishes the table and its lifecycle CHECK. See docs/finance-ledger.md.';
