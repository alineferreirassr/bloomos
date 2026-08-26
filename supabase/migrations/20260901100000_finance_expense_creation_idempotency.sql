-- Finance F2.1C-F-E-D-B2: Create Expense request idempotency.
--
-- Founder decision (F2.1C-F-E-A/E-D-A/E-D-B2-A, Option B): a UI-only fix is
-- not accepted as sufficient — Create Expense must distinguish a retry of
-- the SAME logical request from a NEW intentional expense using explicit
-- durable request identity, the same mechanism already protecting Refund,
-- Deposit Application, Deposit Application Reversal, Manual Adjustment,
-- Payment/Settlement, and Create Invoice.
--
-- SCOPE: this migration owns Create Expense only. Edit Expense
-- (updateExpense), every Expense lifecycle transition
-- (recordExpenseTransition / post_expense_transition), and
-- duplicateExpense() are untouched — none of them create an
-- ambiguous-success create request the way a lost/retried Create Expense
-- submission does; edits/transitions target an already-known, stable id,
-- and duplicateExpense is a distinct, deliberate, always-new-resource
-- action, not a retry of anything.
--
-- WHY caller-supplied expenses.id (mirrors Refund/Deposit
-- Application/Payment/Create Invoice's identity model, not Manual
-- Adjustment's): expenses.id is already `uuid primary key default
-- gen_random_uuid()` (20260721100200_expenses.sql) — an explicit value in
-- this function's own INSERT column list already overrides that default
-- with zero schema change. An Expense has no pre-existing parent row to
-- key request identity off of, the same shape Payment/Refund/Deposit
-- Application/Invoice share.
--
-- WHY a NEW immutable creation-request snapshot column, NOT a comparison
-- against the Expense's own current persisted columns (Manual
-- Adjustment/Payment's technique): like Invoice, an Expense has a real,
-- deliberate Edit surface (updateExpense) that legitimately mutates the
-- exact same fields (description/amount_minor/category/currency/etc.) a
-- replay comparison would need to check — and Expense's mutable window is
-- open LONGER than Invoice's: updateExpense blocks only on
-- isExpenseTerminal (reimbursed/cancelled/archived), so every field
-- remains freely editable through planned/approved/due/paid, with no
-- field-level lock the way Invoice's post-issuance subtotal/tax/discount/
-- currency lock exists. Comparing against the CURRENT row would make a
-- stale retry of an original creation request spuriously conflict (or
-- worse, silently succeed against edited data) after a later, unrelated,
-- legitimate edit — this migration avoids that by never comparing against
-- live Expense columns for replay purposes. Instead, the exact payload
-- submitted at creation is frozen once, at INSERT time, into a new
-- `creation_request_snapshot` column that no other function in this schema
-- ever writes to again — updateExpense, every transition function, and
-- duplicateExpense are all untouched by this migration and none of them
-- reference this column. A replay reads this frozen snapshot, compares it
-- to the incoming request, and — on a match — returns the Expense's
-- CURRENT state unmutated (preserving any legitimate edits since
-- creation), never re-inserting and never overwriting.
--
-- WHY a same-row jsonb column, NOT a separate operation/idempotency table:
-- identical reasoning to Create Invoice's own migration — the
-- caller-supplied id already becomes the Expense's own primary key, so the
-- replay lookup already fetches the row by that id in a single query;
-- storing the frozen snapshot as a column on that same row costs zero
-- additional queries and zero additional tables, matching every other
-- migration in this idempotency series.
--
-- WHY NO generated-number retry loop (unlike Create Invoice): expenses has
-- no analog of invoices_workspace_number_unique — no generated
-- number/reference exists for Expense at all (`reference` is plain,
-- optional, Founder-supplied free text). The fresh-insert path is
-- therefore a single, un-looped INSERT — there is nothing legitimate to
-- retry on a unique-violation here.
--
-- CONCURRENCY: like every prior resource in this series with no natural
-- parent row to lock, expenses.id's own PRIMARY KEY constraint remains the
-- absolute backstop: two concurrent requests sharing the exact same
-- p_expense_id can never both commit a row. No exception handler is added
-- for an id (PK) collision — matching this migration set's own established
-- "no exception handlers" convention (there is no generated-number
-- collision to distinguish it from in the first place, unlike Invoice) —
-- so the losing transaction in that one narrow, vanishingly rare race
-- surfaces a raw Postgres primary-key-violation error rather than the
-- friendly P1129 message, exactly the same accepted cosmetic nuance
-- already documented for Refund, Deposit Application, Payment/Settlement,
-- and Create Invoice: no resource or financial duplication is possible
-- either way, and a subsequent retry with the same id finds the
-- now-committed row via the same replay lookup.
--
-- ACCOUNTING: createExpense posts no Journal Entry today (confirmed fresh
-- from source in F2.1C-F-E-D-A and F2.1C-F-E-D-B2-A) and this migration
-- introduces none — all Expense accounting remains exclusively
-- recordExpenseTransition's / post_expense_transition's responsibility,
-- untouched here.
--
-- ERROR CODES: reuses the existing, already-registered P1129 (idempotency
-- key reused for a different payload) / P1130 (required key missing) pair
-- verbatim, with Expense-specific message text — both are already members
-- of the single shared FINANCE_VALIDATION_ERROR_CODES set the TypeScript
-- repository layer uses, so no error-registry change is needed anywhere.
--
-- Scope boundary: does not touch RLS or policies (the new function is
-- `security invoker`, so the existing expenses_insert_workspace_member
-- policy governs its INSERT exactly as it does every other Expense insert
-- today). Does not widen any CHECK constraint. Does not add any index or
-- unique constraint. Does not redefine record_expense_transition,
-- post_expense_transition, or any other function. Does not edit any
-- already-pushed migration. No historical backfill — existing Expense rows
-- simply carry a NULL creation_request_snapshot; they predate this
-- mechanism and can never be the target of a replay lookup under a
-- caller-generated id no pre-existing row could ever match. Does not touch
-- Payment, Settlement, or Invoice in any way.

alter table public.expenses add column if not exists creation_request_snapshot jsonb;

comment on column public.expenses.creation_request_snapshot is
  'Finance F2.1C-F-E-D-B2: immutable, write-once-at-creation snapshot of the exact request payload record_expense_creation received for this row — used only to distinguish a safe replay from a genuine payload conflict on a repeated p_expense_id. NULL for every Expense created before this migration, and for every Expense created via duplicateExpense() (a distinct, always-new-resource action, never a retry). Never written to by updateExpense, recordExpenseTransition, or duplicateExpense — this column is internal idempotency metadata, never a user-facing or caller-supplied Expense field.';

create or replace function public.record_expense_creation(
  p_workspace_id uuid,
  p_event_id uuid,
  p_client_id uuid,
  p_contract_id uuid,
  p_supplier_id uuid,
  p_team_member_id uuid,
  p_category text,
  p_description text,
  p_amount_minor integer,
  p_currency text,
  p_transaction_date date,
  p_due_date date,
  p_reimbursable boolean,
  p_reference text,
  p_notes text,
  p_expense_id uuid
)
returns public.expenses
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_expense public.expenses;
  v_existing public.expenses;
  v_snapshot jsonb;
begin
  if p_expense_id is null then
    raise exception 'p_expense_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same expense creation request).'
      using errcode = 'P1130';
  end if;

  -- Request-level idempotency: checked immediately after the null-id
  -- guard, before any other validation (which could spuriously fail
  -- against CURRENT state on a replay) — same convention as every other
  -- Finance idempotency-key check in this migration set. Scoped to the
  -- calling workspace so a replay can never read or return an expense
  -- belonging to a different workspace.
  select * into v_existing from public.expenses where id = p_expense_id and workspace_id = p_workspace_id;

  if found then
    -- A historical Expense (created before this migration, or via
    -- duplicateExpense) has a NULL snapshot — it must never be treated as
    -- a confirmed replay. Fail safely as a conflict rather than silently
    -- returning someone else's row as if it were this request's own
    -- result.
    if v_existing.creation_request_snapshot is null
      or (v_existing.creation_request_snapshot->>'event_id')::uuid is distinct from p_event_id
      or (v_existing.creation_request_snapshot->>'client_id')::uuid is distinct from p_client_id
      or (v_existing.creation_request_snapshot->>'contract_id')::uuid is distinct from p_contract_id
      or (v_existing.creation_request_snapshot->>'supplier_id')::uuid is distinct from p_supplier_id
      or (v_existing.creation_request_snapshot->>'team_member_id')::uuid is distinct from p_team_member_id
      or (v_existing.creation_request_snapshot->>'category') is distinct from p_category
      or (v_existing.creation_request_snapshot->>'description') is distinct from p_description
      or (v_existing.creation_request_snapshot->>'amount_minor')::integer is distinct from p_amount_minor
      or (v_existing.creation_request_snapshot->>'currency') is distinct from p_currency
      or (v_existing.creation_request_snapshot->>'transaction_date')::date is distinct from p_transaction_date
      or (v_existing.creation_request_snapshot->>'due_date')::date is distinct from p_due_date
      or (v_existing.creation_request_snapshot->>'reimbursable')::boolean is distinct from p_reimbursable
      or (v_existing.creation_request_snapshot->>'reference') is distinct from p_reference
      or (v_existing.creation_request_snapshot->>'notes') is distinct from p_notes
    then
      raise exception 'This idempotency key was already used for a different expense creation request.' using errcode = 'P1129';
    end if;
    -- Safe replay: return the Expense's CURRENT state untouched — any
    -- legitimate edit made since the original creation is preserved, never
    -- overwritten by this stale request's original payload.
    return v_existing;
  end if;

  v_snapshot := jsonb_build_object(
    'event_id', p_event_id,
    'client_id', p_client_id,
    'contract_id', p_contract_id,
    'supplier_id', p_supplier_id,
    'team_member_id', p_team_member_id,
    'category', p_category,
    'description', p_description,
    'amount_minor', p_amount_minor,
    'currency', p_currency,
    'transaction_date', p_transaction_date,
    'due_date', p_due_date,
    'reimbursable', p_reimbursable,
    'reference', p_reference,
    'notes', p_notes
  );

  insert into public.expenses (
    id, workspace_id, event_id, client_id, contract_id, supplier_id, team_member_id,
    category, status, description, amount_minor, currency, transaction_date, due_date,
    reimbursable, reference, notes, creation_request_snapshot
  ) values (
    p_expense_id, p_workspace_id, p_event_id, p_client_id, p_contract_id, p_supplier_id, p_team_member_id,
    p_category, 'planned', p_description, p_amount_minor, p_currency, p_transaction_date, p_due_date,
    p_reimbursable, p_reference, p_notes, v_snapshot
  )
  returning * into v_expense;

  return v_expense;
end;
$$;

comment on function public.record_expense_creation(uuid, uuid, uuid, uuid, uuid, uuid, text, text, integer, text, date, date, boolean, text, text, uuid) is
  'Inserts a new planned Expense using the caller-supplied p_expense_id directly as its primary key. Posts no accounting — every Expense transition (due/paid/reimbursed) remains recordExpenseTransition''s exclusive responsibility. Finance F2.1C-F-E-D-B2: p_expense_id is a REQUIRED (P1130 if null) request-level idempotency key. A repeat call with the same key and the same event_id/client_id/contract_id/supplier_id/team_member_id/category/description/amount_minor/currency/transaction_date/due_date/reimbursable/reference/notes payload (compared against an immutable snapshot frozen at creation, never the row''s current editable columns) replays the original Expense with no re-mutation, preserving any legitimate edit made since; a repeat with a different payload is rejected (P1129). A different key with an identical payload always creates a new, independent, legitimate Expense.';
