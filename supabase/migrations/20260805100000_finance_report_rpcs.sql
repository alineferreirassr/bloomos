-- Finance Reports Foundation migration 1 of 1: report RPCs.
--
-- Four read-only, database-side aggregation functions: General Ledger,
-- Trial Balance, Profit and Loss, Balance Sheet. Every one derives
-- exclusively from journal_entries/journal_lines/chart_of_accounts (the
-- ledger), never from invoices/payments/expenses/purchases/
-- inventory_movements directly — see docs/finance-reports.md's Reporting
-- Principles. Only posting_status = 'posted' lines participate; a reversal
-- is represented naturally through its own reversing lines (its own
-- posted, source_type = 'reversal' entry), never by hiding or rewriting
-- the entry it reverses.
--
-- These are the first READ-side RPCs in this schema — every prior Finance
-- RPC is a WRITE (a posting or period-lifecycle mutation). They exist
-- because the alternative (loading every matching Journal Line into the
-- browser and summing there) would mean shipping the entire ledger to the
-- client merely to compute a statement, and would duplicate this exact
-- accounting math in TypeScript where it could drift from a future
-- Postgres-side change. `security invoker` + `set search_path = public`
-- matches every existing RPC; each is also `stable` (never modifies data),
-- a real, accurate declaration this schema's write RPCs never needed.
--
-- A fresh single error code, P1200, covers every report input-validation
-- failure across all four functions (missing or inverted date range,
-- mismatched comparison-period bounds) — there is no need for the finer
-- P1100-range granularity the Posting Engine's writes required, since a
-- report either has a syntactically valid date range or it does not.
--
-- No workspace-membership check is performed explicitly inside any of
-- these functions, matching every existing RPC's own reliance on RLS: a
-- `security invoker` function runs as the calling user, and every table
-- read here (chart_of_accounts/journal_entries/journal_lines) already
-- carries a `select` policy scoped to `is_workspace_member(workspace_id)`.
-- p_workspace_id is still an explicit parameter — the same "which of my
-- workspaces" business filter every existing read query in this codebase
-- already applies on top of RLS, not a second security boundary.
--
-- No new index is added by this migration — journal_entries_workspace_
-- date_idx (workspace_id, entry_date) and journal_lines_account_workspace_
-- idx (account_id, workspace_id), both already committed by the Database
-- Schema phase, cover every query shape these four functions use; the
-- latter's own migration comment already anticipated this exact use case
-- ("the index every P&L/Balance Sheet report query depends on"). See
-- docs/finance-reports.md's Reporting Index Review for the full review.

-- ---------------------------------------------------------------------------
-- finance_general_ledger_report — one row per posted Journal Line within
-- [p_start_date, p_end_date], for every account matching the optional
-- account_id/account_type filter, each carrying a running_balance_minor
-- already seeded by that account's opening balance (all posted activity
-- strictly before p_start_date). p_source_type narrows which transactions
-- are *displayed*, never which ones count toward opening/running balances
-- — a balance filtered by source_type would not reconcile to the account's
-- real balance and would silently violate "opening + movement = closing".
-- Deterministic ordering: account_number, entry_date, Journal Entry
-- created_at, journal_entry_id, journal_line_id.
-- ---------------------------------------------------------------------------

create or replace function public.finance_general_ledger_report(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date,
  p_account_id uuid default null,
  p_account_type text default null,
  p_source_type text default null
)
returns table (
  account_id uuid,
  account_number integer,
  account_name text,
  account_type text,
  normal_balance text,
  opening_balance_minor integer,
  journal_entry_id uuid,
  entry_date date,
  memo text,
  source_type text,
  source_id text,
  posting_status text,
  journal_line_id uuid,
  line_memo text,
  debit_minor integer,
  credit_minor integer,
  running_balance_minor integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'A start date and end date are required.' using errcode = 'P1200';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must not be before start date.' using errcode = 'P1200';
  end if;

  return query
  with eligible_accounts as (
    select coa.id, coa.account_number, coa.name, coa.account_type, coa.normal_balance
    from public.chart_of_accounts coa
    where coa.workspace_id = p_workspace_id
      and (p_account_id is null or coa.id = p_account_id)
      and (p_account_type is null or coa.account_type = p_account_type)
  ),
  posted_lines as (
    select
      jl.id as journal_line_id, jl.account_id, jl.debit_minor, jl.credit_minor, jl.line_memo,
      je.id as journal_entry_id, je.entry_date, je.memo, je.source_type, je.source_id, je.posting_status, je.created_at
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where je.workspace_id = p_workspace_id and je.posting_status = 'posted'
  ),
  opening as (
    select pl.account_id,
      coalesce(sum(case when ea.normal_balance = 'debit' then pl.debit_minor - pl.credit_minor else pl.credit_minor - pl.debit_minor end), 0) as opening_balance_minor
    from posted_lines pl
    join eligible_accounts ea on ea.id = pl.account_id
    where pl.entry_date < p_start_date
    group by pl.account_id
  ),
  activity as (
    select pl.*
    from posted_lines pl
    join eligible_accounts ea on ea.id = pl.account_id
    where pl.entry_date >= p_start_date and pl.entry_date <= p_end_date
  )
  -- Driven from eligible_accounts (not activity) so an account with zero
  -- in-range transactions still gets exactly one output row — its opening
  -- balance carried through unchanged as its running/closing balance —
  -- rather than being silently omitted from the report entirely.
  select
    ea.id as account_id, ea.account_number, ea.name as account_name, ea.account_type, ea.normal_balance,
    coalesce(o.opening_balance_minor, 0)::integer as opening_balance_minor,
    a.journal_entry_id, a.entry_date, a.memo, a.source_type, a.source_id, a.posting_status,
    a.journal_line_id, a.line_memo, a.debit_minor, a.credit_minor,
    (
      coalesce(o.opening_balance_minor, 0)
      + sum(
          case when ea.normal_balance = 'debit'
            then coalesce(a.debit_minor, 0) - coalesce(a.credit_minor, 0)
            else coalesce(a.credit_minor, 0) - coalesce(a.debit_minor, 0)
          end
        ) over (partition by ea.id order by a.entry_date, a.created_at, a.journal_entry_id, a.journal_line_id)
    )::integer as running_balance_minor
  from eligible_accounts ea
  left join opening o on o.account_id = ea.id
  left join activity a on a.account_id = ea.id
  where a.journal_entry_id is null or p_source_type is null or a.source_type = p_source_type
  order by ea.account_number, a.entry_date, a.created_at, a.journal_entry_id, a.journal_line_id;
end;
$$;

comment on function public.finance_general_ledger_report(uuid, date, date, uuid, text, text) is
  'General Ledger: one row per posted Journal Line in [p_start_date, p_end_date], driven from every eligible account (an account with zero in-range activity still gets one row, opening balance carried through as its running/closing balance) with a running_balance_minor seeded by the account''s opening balance (all posted activity strictly before p_start_date). p_source_type narrows which rows are displayed, never the opening/running balance math itself. Deterministic order: account_number, entry_date, created_at, journal_entry_id, journal_line_id.';

-- ---------------------------------------------------------------------------
-- finance_trial_balance_report — one row per account as of p_as_of_date,
-- with raw total debit/credit activity (never pre-split onto an ending
-- side — see splitEndingBalance/validateTrialBalance in
-- lib/data/finance/reportCalculations.ts, the single shared place that
-- placement math happens for both this RPC's rows and the mock
-- repository's equivalent computation). Zero-activity accounts are
-- excluded unless p_include_zero_balances is true; an archived account
-- with historical activity is never excluded by its archived status alone.
-- ---------------------------------------------------------------------------

create or replace function public.finance_trial_balance_report(
  p_workspace_id uuid,
  p_as_of_date date,
  p_include_zero_balances boolean default false
)
returns table (
  account_id uuid,
  account_number integer,
  account_name text,
  account_type text,
  normal_balance text,
  is_archived boolean,
  total_debit_minor integer,
  total_credit_minor integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_as_of_date is null then
    raise exception 'An as-of date is required.' using errcode = 'P1200';
  end if;

  return query
  with posted_lines as (
    select jl.account_id, jl.debit_minor, jl.credit_minor
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where je.workspace_id = p_workspace_id and je.posting_status = 'posted' and je.entry_date <= p_as_of_date
  )
  select
    coa.id, coa.account_number, coa.name, coa.account_type, coa.normal_balance,
    (coa.archived_at is not null) as is_archived,
    coalesce(sum(pl.debit_minor), 0)::integer as total_debit_minor,
    coalesce(sum(pl.credit_minor), 0)::integer as total_credit_minor
  from public.chart_of_accounts coa
  left join posted_lines pl on pl.account_id = coa.id
  where coa.workspace_id = p_workspace_id
  group by coa.id, coa.account_number, coa.name, coa.account_type, coa.normal_balance, coa.archived_at
  having p_include_zero_balances or coalesce(sum(pl.debit_minor), 0) <> 0 or coalesce(sum(pl.credit_minor), 0) <> 0
  order by coa.account_number;
end;
$$;

comment on function public.finance_trial_balance_report(uuid, date, boolean) is
  'Trial Balance: one row per account with raw total debit/credit activity through p_as_of_date (never pre-split onto an ending side — see reportCalculations.ts). Excludes zero-activity accounts unless p_include_zero_balances; archived accounts with activity are never excluded by archived status alone.';

-- ---------------------------------------------------------------------------
-- finance_profit_and_loss_report — one row per income-statement account
-- (revenue, contra_revenue, cost_of_goods_sold, operating_expense,
-- other_income, other_expense) with its raw debit/credit MOVEMENT during
-- [p_start_date, p_end_date] — a flow, not a running balance, since this
-- ledger has no period-closing mechanism that would otherwise reset these
-- accounts (see docs/finance-reports.md's Current-Period Earnings
-- Treatment). An optional comparison period returns the same movement
-- shape for a second range in the same row, so the caller never issues two
-- calls. Section/subtotal assembly and normal-balance sign application
-- happen in TypeScript via the same shared reportCalculations.ts used by
-- the mock repository, not here — this function only aggregates.
-- ---------------------------------------------------------------------------

create or replace function public.finance_profit_and_loss_report(
  p_workspace_id uuid,
  p_start_date date,
  p_end_date date,
  p_comparison_start_date date default null,
  p_comparison_end_date date default null
)
returns table (
  account_id uuid,
  account_number integer,
  account_name text,
  account_type text,
  normal_balance text,
  current_debit_minor integer,
  current_credit_minor integer,
  comparison_debit_minor integer,
  comparison_credit_minor integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if p_start_date is null or p_end_date is null then
    raise exception 'A start date and end date are required.' using errcode = 'P1200';
  end if;
  if p_end_date < p_start_date then
    raise exception 'End date must not be before start date.' using errcode = 'P1200';
  end if;
  if (p_comparison_start_date is null) <> (p_comparison_end_date is null) then
    raise exception 'A comparison period requires both a start date and an end date.' using errcode = 'P1200';
  end if;
  if p_comparison_end_date is not null and p_comparison_end_date < p_comparison_start_date then
    raise exception 'Comparison end date must not be before comparison start date.' using errcode = 'P1200';
  end if;

  return query
  with income_statement_accounts as (
    select coa.id, coa.account_number, coa.name, coa.account_type, coa.normal_balance
    from public.chart_of_accounts coa
    where coa.workspace_id = p_workspace_id
      and coa.account_type in ('revenue', 'contra_revenue', 'cost_of_goods_sold', 'operating_expense', 'other_income', 'other_expense')
  ),
  posted_lines as (
    select jl.account_id, jl.debit_minor, jl.credit_minor, je.entry_date
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where je.workspace_id = p_workspace_id and je.posting_status = 'posted'
  )
  select
    isa.id, isa.account_number, isa.name, isa.account_type, isa.normal_balance,
    coalesce(sum(pl.debit_minor) filter (where pl.entry_date between p_start_date and p_end_date), 0)::integer as current_debit_minor,
    coalesce(sum(pl.credit_minor) filter (where pl.entry_date between p_start_date and p_end_date), 0)::integer as current_credit_minor,
    coalesce(sum(pl.debit_minor) filter (where p_comparison_start_date is not null and pl.entry_date between p_comparison_start_date and p_comparison_end_date), 0)::integer as comparison_debit_minor,
    coalesce(sum(pl.credit_minor) filter (where p_comparison_start_date is not null and pl.entry_date between p_comparison_start_date and p_comparison_end_date), 0)::integer as comparison_credit_minor
  from income_statement_accounts isa
  left join posted_lines pl on pl.account_id = isa.id
  group by isa.id, isa.account_number, isa.name, isa.account_type, isa.normal_balance
  order by isa.account_number;
end;
$$;

comment on function public.finance_profit_and_loss_report(uuid, date, date, date, date) is
  'Profit and Loss: one row per income-statement account with raw debit/credit movement (a flow, not a running balance) during [p_start_date, p_end_date], plus the same shape for an optional comparison period. Section/subtotal assembly and normal-balance sign application happen in TypeScript (reportCalculations.ts), shared with the mock repository.';

-- ---------------------------------------------------------------------------
-- finance_balance_sheet_report — one row per asset/liability/equity
-- account with its cumulative closing balance through p_as_of_date, plus
-- current_period_earnings_minor repeated identically on every row: the
-- cumulative net income of every income-statement account from the
-- ledger's inception through p_as_of_date. No closing-entry mechanism
-- exists yet in this schema (nothing ever posts to 3900 Retained
-- Earnings), so this is the correct, non-speculative reporting-only
-- treatment that keeps Assets = Liabilities + Equity holding — omitting it
-- would break the accounting equation, and folding it into 3900 would
-- misrepresent an account nothing actually posted to. See
-- docs/finance-reports.md's Current-Period Earnings Treatment.
--
-- Net income here is uniformly (credit_minor - debit_minor) summed across
-- every income-statement line, regardless of each account's own
-- normal_balance: a credit-normal revenue account's credit increases
-- income (credit - debit, positive); a debit-normal expense or
-- contra-revenue account's debit REDUCES income by the same amount
-- (credit - debit = -debit, negative) — the sign already comes out right
-- without a per-account CASE.
-- ---------------------------------------------------------------------------

create or replace function public.finance_balance_sheet_report(
  p_workspace_id uuid,
  p_as_of_date date
)
returns table (
  account_id uuid,
  account_number integer,
  account_name text,
  account_type text,
  parent_account_id uuid,
  closing_balance_minor integer,
  current_period_earnings_minor integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_earnings integer;
begin
  if p_as_of_date is null then
    raise exception 'An as-of date is required.' using errcode = 'P1200';
  end if;

  select coalesce(sum(jl.credit_minor - jl.debit_minor), 0)::integer
  into v_earnings
  from public.journal_lines jl
  join public.journal_entries je on je.id = jl.journal_entry_id
  join public.chart_of_accounts coa on coa.id = jl.account_id
  where je.workspace_id = p_workspace_id
    and je.posting_status = 'posted'
    and je.entry_date <= p_as_of_date
    and coa.account_type in ('revenue', 'contra_revenue', 'cost_of_goods_sold', 'operating_expense', 'other_income', 'other_expense');

  return query
  with balance_sheet_accounts as (
    select coa.id, coa.account_number, coa.name, coa.account_type, coa.parent_account_id, coa.normal_balance
    from public.chart_of_accounts coa
    where coa.workspace_id = p_workspace_id and coa.account_type in ('asset', 'liability', 'equity')
  ),
  posted_lines as (
    select jl.account_id, jl.debit_minor, jl.credit_minor
    from public.journal_lines jl
    join public.journal_entries je on je.id = jl.journal_entry_id
    where je.workspace_id = p_workspace_id and je.posting_status = 'posted' and je.entry_date <= p_as_of_date
  )
  select
    bsa.id, bsa.account_number, bsa.name, bsa.account_type, bsa.parent_account_id,
    coalesce(sum(case when bsa.normal_balance = 'debit' then pl.debit_minor - pl.credit_minor else pl.credit_minor - pl.debit_minor end), 0)::integer as closing_balance_minor,
    v_earnings as current_period_earnings_minor
  from balance_sheet_accounts bsa
  left join posted_lines pl on pl.account_id = bsa.id
  group by bsa.id, bsa.account_number, bsa.name, bsa.account_type, bsa.parent_account_id
  order by bsa.account_number;
end;
$$;

comment on function public.finance_balance_sheet_report(uuid, date) is
  'Balance Sheet: one row per asset/liability/equity account with its cumulative closing balance through p_as_of_date, plus current_period_earnings_minor (cumulative net income of every income-statement account since ledger inception) repeated on every row — the correct reporting-only treatment given no closing-entry mechanism exists yet. See docs/finance-reports.md.';
