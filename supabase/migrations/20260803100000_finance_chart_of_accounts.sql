-- Finance Database migration 1 of 11: chart_of_accounts table.
--
-- Mirrors the Finance Event Matrix's approved account list exactly (seeded
-- in migration 11 of this set). Workspace-scoped, not global — every
-- workspace gets its own Chart of Accounts, the same boundary every other
-- table in this schema already uses, which is what makes multi-company
-- "mostly free" later (see the Finance Architecture's Future Compatibility
-- section) without any redesign here.
--
-- account_number uniqueness is enforced per-workspace in the indexes
-- migration (10 of 11), matching purchases_workspace_number_unique's exact
-- precedent of keeping uniqueness indexes in the dedicated indexes file
-- rather than inline.
--
-- parent_account_id is a self-referencing FK for an optional, shallow
-- grouping hierarchy (e.g. sub-accounts under 6xxx Operating Expenses) —
-- nullable and unused today, reserved so grouping can be introduced later
-- without a schema change.
--
-- is_system marks the ~34 accounts seeded by this module itself (e.g. 1010
-- Stripe Clearing, 2100 Sales Tax Payable) that the Posting Engine's future
-- RPCs will reference by number — distinct from archived_at, which is the
-- ordinary soft-retire lifecycle every table in this schema already uses.
-- A user-created account can be archived; a system account should not be
-- casually renumbered or deleted, though nothing in this migration set
-- hard-enforces that yet (left as an application-layer / future-RPC
-- concern, not a DB constraint).
--
-- normal_balance exists for soft, application-layer sanity checks only —
-- real double-entry accounting legitimately permits a contra-posting against
-- an account's expected normal balance (e.g. crediting an Asset), so it is
-- deliberately never enforced as a hard CHECK against journal_lines'
-- debit/credit direction.

create table if not exists public.chart_of_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  account_number integer not null,
  name text not null,
  account_type text not null,
  normal_balance text not null,
  parent_account_id uuid references public.chart_of_accounts (id),
  description text,
  is_system boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  constraint chart_of_accounts_account_type_check check (
    account_type in (
      'asset', 'liability', 'equity', 'revenue', 'contra_revenue',
      'cost_of_goods_sold', 'operating_expense', 'other_income', 'other_expense'
    )
  ),
  constraint chart_of_accounts_normal_balance_check check (normal_balance in ('debit', 'credit')),
  constraint chart_of_accounts_name_not_blank_check check (btrim(name) <> ''),
  constraint chart_of_accounts_account_number_positive_check check (account_number > 0)
);

comment on table public.chart_of_accounts is
  'Workspace-scoped Chart of Accounts. Seeded with the ~34 accounts designed in the Finance Event Matrix (migration 11 of this set). Read by future Posting Engine RPCs; never written to by any existing module. See docs/finance-ledger.md.';
