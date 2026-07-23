-- Finance Database migration 10 of 11: indexes and constraints.
--
-- btree_gist is enabled here (not in the extensions/helpers migration,
-- since it is needed by nothing before this point) so the accounting
-- periods overlap-prevention EXCLUDE constraint below can mix a uuid
-- equality comparison with a daterange overlap check in one GiST index —
-- plain GiST alone does not support equality on non-range types.
create extension if not exists btree_gist with schema extensions;

-- chart_of_accounts: workspace-scoped account_number uniqueness.
create unique index if not exists chart_of_accounts_workspace_account_number_unique
  on public.chart_of_accounts (workspace_id, account_number);

create index if not exists chart_of_accounts_workspace_id_idx on public.chart_of_accounts (workspace_id);

-- accounting_periods: lookup by date, plus the overlap-prevention
-- constraint itself — no two periods for the same workspace may cover the
-- same date.
create index if not exists accounting_periods_workspace_start_idx
  on public.accounting_periods (workspace_id, period_start);

alter table public.accounting_periods
  add constraint accounting_periods_no_overlap
  exclude using gist (
    workspace_id with =,
    daterange(period_start, period_end, '[]') with &&
  );

-- journal_entries: the posting_key — this is the idempotency mechanism from
-- the Finance Posting Engine Specification. Deliberately excludes
-- 'purchase_receipt' (the same purchase_item can be received across
-- multiple partial receipts, so uniqueness on its id would wrongly reject a
-- valid second receipt — idempotency for that event type instead relies on
-- the domain's own over-receipt guard) and 'manual_adjustment' (source_id
-- is always null for that type by the source-consistency CHECK in
-- migration 3, and a partial unique index over an always-null value would
-- be meaningless).
create unique index if not exists journal_entries_posting_key_unique
  on public.journal_entries (source_type, source_id)
  where source_id is not null and source_type not in ('purchase_receipt', 'manual_adjustment');

-- The single most common query shape — every report filters by workspace
-- and date range.
create index if not exists journal_entries_workspace_date_idx on public.journal_entries (workspace_id, entry_date);

create index if not exists journal_entries_period_idx on public.journal_entries (accounting_period_id);

-- Partial index: the failed-postings recovery queue only ever looks at a
-- small minority of rows (posted is the overwhelming majority), so indexing
-- only pending/failed avoids indexing rows that will never be queried this way.
create index if not exists journal_entries_pending_failed_idx
  on public.journal_entries (posting_status)
  where posting_status in ('pending', 'failed');

-- journal_lines: fetching all lines for an entry (needed on every read),
-- and the index every P&L/Balance Sheet report query depends on — "sum all
-- lines for this account, this workspace."
create index if not exists journal_lines_entry_id_idx on public.journal_lines (journal_entry_id);
create index if not exists journal_lines_account_workspace_idx on public.journal_lines (account_id, workspace_id);

-- stripe_webhook_events: the whole idempotency mechanism for webhook
-- delivery, plus the same failed-queue partial-index reasoning as journal_entries.
create unique index if not exists stripe_webhook_events_stripe_event_id_unique
  on public.stripe_webhook_events (stripe_event_id);

create index if not exists stripe_webhook_events_pending_failed_idx
  on public.stripe_webhook_events (posting_status)
  where posting_status in ('pending', 'failed');
