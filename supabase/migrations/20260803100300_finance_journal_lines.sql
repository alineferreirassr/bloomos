-- Finance Database migration 4 of 11: journal_lines table.
--
-- Child rows of journal_entries — the actual debit/credit amounts. A
-- Journal Entry is "balanced" when the sum of its lines' debit_minor equals
-- the sum of their credit_minor; that cross-row invariant cannot be a
-- single-row CHECK constraint (Postgres CHECK constraints only see one row),
-- so it is enforced by a deferred constraint trigger instead (migration 8).
--
-- debit_minor/credit_minor are `integer`, matching every other money column
-- in this schema (purchases/purchase_items/invoices/payments/expenses all
-- use integer minor-unit amounts, never float/numeric) — not `bigint`,
-- staying consistent rather than introducing a new width for this one
-- table.
--
-- Exactly one of debit_minor/credit_minor is nonzero per line (enforced
-- below) — direction is expressed by *which* column is populated, never by
-- sign; both are always >= 0.
--
-- workspace_id is denormalized from the parent journal_entries row
-- (deliberate, for RLS/query performance — the same reasoning purchase_items
-- already carrying its own workspace_id follows) and is kept consistent
-- with the parent by a trigger (migration 8), since Postgres can't express
-- "these two columns across two tables must match" as a plain FK.
--
-- journal_entry_id has no explicit `on delete` clause (defaults to
-- RESTRICT) — spelled out explicitly here even though it's the Postgres
-- default, since journal_entries are never deleted in practice and this
-- makes that intent unambiguous in the schema itself, not just in prose.
--
-- amount_in_base_currency_minor is a reserved multi-currency column (see
-- the Finance Posting Engine Specification) — defaults to the same value as
-- the net line amount today; no conversion logic exists yet.
--
-- No `updated_at` and no update/delete path exist at all for this table —
-- fully append-only, enforced by the append-only trigger (migration 8).

create table if not exists public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  journal_entry_id uuid not null references public.journal_entries (id) on delete restrict,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_id uuid not null references public.chart_of_accounts (id) on delete restrict,
  debit_minor integer not null default 0,
  credit_minor integer not null default 0,
  currency text not null default 'USD',
  amount_in_base_currency_minor integer not null default 0,
  line_memo text,
  line_order integer not null default 0,

  created_at timestamptz not null default now(),

  constraint journal_lines_debit_minor_check check (debit_minor >= 0),
  constraint journal_lines_credit_minor_check check (credit_minor >= 0),
  constraint journal_lines_one_side_check check (
    (debit_minor > 0 and credit_minor = 0) or (debit_minor = 0 and credit_minor > 0)
  ),
  constraint journal_lines_currency_check check (char_length(currency) = 3),
  constraint journal_lines_base_amount_check check (amount_in_base_currency_minor >= 0)
);

comment on table public.journal_lines is
  'Debit/credit lines belonging to a journal_entries row. Exactly one of debit_minor/credit_minor is nonzero per line. Balance across a whole entry is enforced by a deferred constraint trigger (migration 8), not a CHECK, since balance is a cross-row property. Fully append-only: no update path exists. See docs/finance-ledger.md.';
