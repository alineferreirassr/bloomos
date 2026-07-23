-- Finance Posting Engine migration 4 of 9: post_expense_transition +
-- record_expense_transition.
--
-- Same situation as Payments: Expense has no pre-existing owning-mutation
-- RPC (status changes happen via a plain repository UPDATE today), so
-- record_expense_transition is introduced as that owning mutation — a pure
-- database RPC, not Finance Repository work.
--
-- post_expense_transition(p_expense_id, p_transition, p_actor) is
-- path-dependent, per the approved Event Matrix:
--   'due'        — Debit [category account], Credit 2000 Accounts Payable
--   'paid'       — if a prior 'expense_due' entry exists for this expense:
--                    Debit 2000 Accounts Payable, Credit 1000 Cash
--                  else (direct payment, no prior accrual):
--                    Debit [category account], Credit 1000 Cash
--   'reimbursed' — Debit 6280 Employee Reimbursements, Credit 1000 Cash
--
-- Never posts the expense twice: each transition has its own source_type
-- ('expense_due' / 'expense_paid' / 'expense_reimbursed'), each already
-- covered by the general posting_key partial unique index (only
-- 'purchase_receipt' and 'manual_adjustment' are excluded from it) — an
-- expense legitimately gets at most one entry per transition, unlike a
-- Purchase receipt which can recur.
--
-- Category -> account_number mapping mirrors the Chart of Accounts seeded
-- in the Database Schema phase exactly, with the two documented special
-- cases: category = 'inventory' debits 1200 Inventory Asset (acquiring
-- stock, not a P&L expense) and category = 'refund' debits 4950 Refunds &
-- Returns (a contra-revenue event, not an operating expense) — both called
-- out explicitly in the approved Chart of Accounts.

create or replace function public.finance_resolve_expense_category_account(
  p_workspace_id uuid,
  p_category text
)
returns public.chart_of_accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_number integer;
begin
  v_account_number := case p_category
    when 'decor' then 6100
    when 'flowers' then 6110
    when 'rentals' then 6120
    when 'venue' then 6130
    when 'photography' then 6140
    when 'video' then 6150
    when 'food_beverage' then 6160
    when 'transportation' then 6170
    when 'printing' then 6180
    when 'supplies' then 6190
    when 'inventory' then 1200
    when 'team_payroll' then 6200
    when 'supplier_payment' then 6210
    when 'marketing' then 6220
    when 'software' then 6230
    when 'insurance' then 6240
    when 'taxes' then 6250
    when 'fees' then 6260
    when 'travel' then 6270
    when 'refund' then 4950
    when 'reimbursement' then 6280
    when 'miscellaneous' then 6900
    else null
  end;

  if v_account_number is null then
    raise exception 'No account mapping exists for Expense category %.', p_category using errcode = 'P1100';
  end if;

  return public.finance_resolve_account(p_workspace_id, v_account_number);
end;
$$;

comment on function public.finance_resolve_expense_category_account(uuid, text) is
  'Maps an ExpenseCategory to its Chart of Accounts account, per the approved Event Matrix. category=''inventory'' resolves to 1200 Inventory Asset (an acquisition, not a P&L expense); category=''refund'' resolves to 4950 Refunds & Returns (contra-revenue).';

create or replace function public.post_expense_transition(
  p_expense_id uuid,
  p_transition text,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses;
  v_source_type text;
  v_posting_key text;
  v_debit_account public.chart_of_accounts;
  v_credit_account public.chart_of_accounts;
  v_had_due_entry boolean;
  v_entry public.journal_entries;
begin
  if p_transition not in ('due', 'paid', 'reimbursed') then
    raise exception 'Unsupported Expense transition: %.', p_transition using errcode = 'P1105';
  end if;

  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense not found.' using errcode = 'P1111';
  end if;

  v_source_type := case p_transition
    when 'due' then 'expense_due'
    when 'paid' then 'expense_paid'
    when 'reimbursed' then 'expense_reimbursed'
  end;

  if exists (select 1 from public.journal_entries where source_type = v_source_type and source_id = p_expense_id::text) then
    raise exception 'This Expense has already been posted for the % transition.', p_transition using errcode = 'P1104';
  end if;

  -- posting_key intentionally does not reuse v_source_type verbatim: the
  -- reimbursed source_type ('expense_reimbursed') is fixed by the existing
  -- journal_entries_source_type_check constraint, but the standardized
  -- posting_key vocabulary spells this event 'expense_reimbursement'.
  v_posting_key := case p_transition
    when 'due' then 'expense_due:' || p_expense_id
    when 'paid' then 'expense_paid:' || p_expense_id
    when 'reimbursed' then 'expense_reimbursement:' || p_expense_id
  end;

  if p_transition = 'due' then
    v_debit_account := public.finance_resolve_expense_category_account(v_expense.workspace_id, v_expense.category);
    v_credit_account := public.finance_resolve_account(v_expense.workspace_id, 2000);
  elsif p_transition = 'paid' then
    select exists(
      select 1 from public.journal_entries where source_type = 'expense_due' and source_id = p_expense_id::text
    ) into v_had_due_entry;

    if v_had_due_entry then
      v_debit_account := public.finance_resolve_account(v_expense.workspace_id, 2000);
    else
      v_debit_account := public.finance_resolve_expense_category_account(v_expense.workspace_id, v_expense.category);
    end if;
    v_credit_account := public.finance_resolve_account(v_expense.workspace_id, 1000);
  else -- reimbursed
    v_debit_account := public.finance_resolve_account(v_expense.workspace_id, 6280);
    v_credit_account := public.finance_resolve_account(v_expense.workspace_id, 1000);
  end if;

  v_entry := public.finance_insert_journal_entry(
    v_expense.workspace_id,
    coalesce(v_expense.due_date, v_expense.transaction_date),
    v_source_type,
    p_expense_id::text,
    'Expense ' || p_transition || ': "' || v_expense.description || '"',
    p_actor,
    null,
    v_posting_key,
    jsonb_build_array(
      jsonb_build_object('account_id', v_debit_account.id, 'debit_minor', v_expense.amount_minor, 'credit_minor', 0),
      jsonb_build_object('account_id', v_credit_account.id, 'debit_minor', 0, 'credit_minor', v_expense.amount_minor)
    )
  );

  return v_entry;
end;
$$;

comment on function public.post_expense_transition(uuid, text, text) is
  'Posts one Expense lifecycle transition (due/paid/reimbursed), path-dependent on whether a prior expense_due entry exists. Never double-recognizes the same expense — each transition has its own source_type, one entry each, enforced by the existing source_type/source_id unique index plus a row lock; also carries a deterministic posting_key (expense_due:<id> / expense_paid:<id> / expense_reimbursement:<id>) for the newer workspace-scoped idempotency mechanism.';

create or replace function public.record_expense_transition(
  p_expense_id uuid,
  p_transition text,
  p_actor text
)
returns public.expenses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses;
begin
  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then
    raise exception 'Expense not found.' using errcode = 'P1111';
  end if;

  if p_transition = 'due' then
    if v_expense.status not in ('planned', 'approved') then
      raise exception 'Cannot mark an Expense due from status %.', v_expense.status using errcode = 'P1105';
    end if;
    update public.expenses set status = 'due', updated_at = now() where id = p_expense_id returning * into v_expense;
  elsif p_transition = 'paid' then
    if v_expense.status not in ('planned', 'approved', 'due') then
      raise exception 'Cannot mark an Expense paid from status %.', v_expense.status using errcode = 'P1105';
    end if;
    update public.expenses set status = 'paid', paid_at = now(), updated_at = now() where id = p_expense_id returning * into v_expense;
  elsif p_transition = 'reimbursed' then
    if v_expense.status <> 'paid' then
      raise exception 'Cannot mark an Expense reimbursed from status %.', v_expense.status using errcode = 'P1105';
    end if;
    update public.expenses set status = 'reimbursed', reimbursed_at = now(), updated_at = now() where id = p_expense_id returning * into v_expense;
  else
    raise exception 'Unsupported Expense transition: %.', p_transition using errcode = 'P1105';
  end if;

  perform public.post_expense_transition(p_expense_id, p_transition, p_actor);

  return v_expense;
end;
$$;

comment on function public.record_expense_transition(uuid, text, text) is
  'The owning Expense mutation post_expense_transition composes into: validates the status transition (due/paid/reimbursed), updates status/paid_at/reimbursed_at, and posts the financial impact — all in one transaction.';
