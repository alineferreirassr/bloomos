-- Finance Database migration 3 of 11: journal_entries table.
--
-- One row per accounting event (a Purchase receipt, an Invoice issuance, a
-- Manual Adjustment, ...), holding the entry-level facts; the actual
-- debit/credit amounts live in the child journal_lines table (migration 4),
-- mirroring purchases/purchase_items' exact parent/child split.
--
-- source_type/source_id is a deliberately polymorphic reference, NOT a real
-- foreign key — the same shape inventory_movements.reference_type/
-- reference_id and media_assets.owner_type/owner_id already use in this
-- schema. A true FK would require either one nullable column per possible
-- source table, or forcing every domain module (Purchases, Invoices,
-- Payments, Expenses, Inventory) to dual-write into a Finance-owned table —
-- both rejected by the approved Finance Architecture's core decision that
-- Finance owns the accounting *representation*, never the business objects
-- themselves.
--
-- source_id is `text`, not `uuid` — it must also hold external string
-- identifiers (a Stripe payout id like "po_1Nxxxx"), not only internal
-- uuid-keyed rows. Storing it as text lets both cases share one column
-- without a second discriminated type.
--
-- The posting_key uniqueness constraint (source_type, source_id) is a
-- PARTIAL index added in the indexes migration (10 of 11) — it deliberately
-- excludes 'purchase_receipt' and 'manual_adjustment': the same
-- purchase_item can legitimately be received across multiple partial
-- receipts (so uniqueness on its id would wrongly reject a valid second
-- receipt), and a manual_adjustment's source_id is always null by
-- definition. See that migration's own comment for the full reasoning.
--
-- reversed_by_entry_id / reverses_entry_id are two separate self-referencing
-- columns (not one, derived) so both query directions — "find the reversal
-- of X" and "find what Y reverses" — are direct lookups, not joins. Kept
-- mutually consistent by the reversal-integrity trigger (migration 8).
--
-- No `updated_at` column exists on this table by design: unlike
-- chart_of_accounts/accounting_periods (ordinary lifecycle rows),
-- journal_entries is append-only except for the three status-tracking
-- columns (posting_status, failure_reason, reversed_by_entry_id) — the
-- append-only trigger (migration 8) enforces this at the database layer,
-- the same "no updated_at on an append-only table" choice
-- inventory_movements already made.
--
-- posted_by is free text, matching created_by/performed_by's existing
-- convention across purchases/inventory_movements — not a foreign key to
-- auth.users.

create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  entry_date date not null,
  accounting_period_id uuid not null references public.accounting_periods (id),
  source_type text not null,
  source_id text,
  memo text,
  currency text not null default 'USD',
  reversed_by_entry_id uuid references public.journal_entries (id),
  reverses_entry_id uuid references public.journal_entries (id),
  posting_status text not null default 'posted',
  failure_reason text,
  posted_by text not null,

  created_at timestamptz not null default now(),

  constraint journal_entries_source_type_check check (
    source_type in (
      'purchase_receipt', 'invoice_issued', 'invoice_voided', 'payment_settlement', 'payment_refund',
      'expense_due', 'expense_paid', 'expense_reimbursed', 'expense_due_reversal',
      'inventory_adjustment', 'inventory_writeoff', 'inventory_event_checkout', 'inventory_event_return',
      'inventory_initial_stock', 'vendor_payment', 'vendor_refund', 'stripe_payout', 'manual_adjustment'
    )
  ),
  constraint journal_entries_posting_status_check check (posting_status in ('pending', 'posted', 'failed', 'reversed')),
  constraint journal_entries_currency_check check (char_length(currency) = 3),
  constraint journal_entries_adjustment_memo_check check (
    source_type <> 'manual_adjustment' or (memo is not null and btrim(memo) <> '')
  ),
  constraint journal_entries_source_consistency_check check (
    (source_id is null) = (source_type = 'manual_adjustment')
  ),
  constraint journal_entries_posted_by_not_blank_check check (btrim(posted_by) <> '')
);

comment on table public.journal_entries is
  'One row per accounting event. Append-only except for posting_status/failure_reason/reversed_by_entry_id (enforced by trigger, migration 8 of this set). source_type/source_id is a deliberate polymorphic reference, not a real FK — see the Finance Database Blueprint''s FK Map. No posting RPCs exist yet (Posting Engine phase); this table exists but nothing writes to it until then. See docs/finance-ledger.md.';
