-- Finance Posting Engine migration 1 of 9: shared internal helpers.
--
-- These are narrow, database-internal helpers called only from the posting
-- RPCs in this migration set — never exposed as a "generic Finance service
-- layer." Same `security invoker` + pinned `search_path = public` convention
-- as every existing RPC in this schema (record_purchase_receipt,
-- record_inventory_movement, recompute_invoice_balance).
--
-- Error codes introduced by this migration set are a fresh P1100-P1116
-- range, distinct from the P1000-P1008 range the Database Schema phase's
-- constraint triggers already claimed:
--   P1100 — missing or archived system account
--   P1101 — missing eligible accounting period for the given entry_date
--   P1102 — period is closed (reject a non-reversal posting)
--   P1103 — period is locked (reject any posting or reversal)
--   P1104 — duplicate posting (idempotency violation for a one-time source)
--   P1105 — invalid lifecycle/status transition
--   P1106 — unbalanced manual adjustment (pre-validated; the deferred
--           balance trigger from the Database Schema phase is the ultimate
--           backstop, this gives a clearer message before that point)
--   P1107 — account does not belong to the given workspace
--   P1108 — account is archived (manual adjustment path)
--   P1109 — journal entry is already reversed
--   P1110 — unsupported Inventory movement type for posting
--   P1111 — missing source document (e.g. payment/expense/entry not found)
--   P1112 — blank or missing reversal reason
--   P1113 — manual adjustment memo is blank
--   P1114 — manual adjustment has fewer than 2 lines
--   P1115 — invalid line (zero-value, or both debit and credit nonzero)
--   P1116 — invalid or overlapping accounting period date range
-- P0010, in the pre-existing Purchases-owned P0005-P0009 range (not this
-- migration set's own P1100+ range, since it validates an input parameter
-- of the Purchases-owned record_purchase_receipt itself), is added by
-- 20260804100100_finance_post_purchase_receipt.sql for a missing/null
-- p_receipt_event_id.
--
-- AUDIT CONTRACT (correction, pre-checkpoint): Journal posting and its
-- owning operational mutation (e.g. updating purchase_items, inventory_
-- items, payments, expenses) are atomic — they commit or roll back
-- together in one Postgres transaction, exactly as every RPC in this
-- migration set is written. Core Audit Log entries are NOT part of that
-- transaction and are not written from SQL anywhere in this schema: Audit
-- currently exists only as a TypeScript-layer service
-- (core/audit — see getCoreAuditLogService()), written by the repository
-- layer AFTER an RPC call returns successfully. This is a deliberate,
-- accepted boundary, not an oversight: it means a Repository implementation
-- must never retry a financial RPC merely because writing the Audit entry
-- afterward failed — the financial event already committed, and retrying
-- the RPC with the same posting_key/receipt_event_id is safe (idempotent)
-- specifically because of the idempotency work in this migration set, but
-- retrying it FOR THIS REASON would be solving the wrong problem: an Audit-
-- write failure is a Repository/observability concern, not a signal that
-- the posting itself needs to happen again. No SQL Audit table or trigger
-- is introduced by this schema to close that gap — see migrations.test.ts
-- for a structural assertion that no parallel Finance-specific audit
-- mechanism exists anywhere in this migration set.
--
-- No exception handlers (`exception when ...`) are used anywhere in this
-- migration set, matching the established convention already asserted by
-- this schema's own migration tests for record_purchase_receipt ("has no
-- exception handler that would swallow a raised error and prevent the
-- whole transaction from rolling back"). Concurrency safety instead comes
-- from row-locking (`for update`) the relevant parent row before any
-- duplicate-posting pre-check, so two concurrent calls serialize on the
-- lock rather than racing past a check — the same pattern
-- record_purchase_receipt's own over-receipt guard already relies on.

-- ---------------------------------------------------------------------------
-- finance_resolve_account — resolves a seeded system account by
-- (workspace_id, account_number), never by hardcoded UUID. Fails clearly if
-- the account is missing or archived rather than silently falling back to
-- another account.
-- ---------------------------------------------------------------------------

create or replace function public.finance_resolve_account(
  p_workspace_id uuid,
  p_account_number integer
)
returns public.chart_of_accounts
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account public.chart_of_accounts;
begin
  select * into v_account
  from public.chart_of_accounts
  where workspace_id = p_workspace_id and account_number = p_account_number and is_system = true;

  if not found then
    raise exception 'System account % not found for this workspace.', p_account_number using errcode = 'P1100';
  end if;

  if v_account.archived_at is not null then
    raise exception 'System account % (%) is archived and cannot be posted to.', p_account_number, v_account.name
      using errcode = 'P1100';
  end if;

  return v_account;
end;
$$;

comment on function public.finance_resolve_account(uuid, integer) is
  'Resolves a seeded system account by (workspace_id, account_number, is_system = true). Raises P1100 if missing or archived — never falls back to another account.';

-- ---------------------------------------------------------------------------
-- finance_resolve_period — resolves the open-or-closed accounting period
-- covering a given entry_date for a workspace. Does NOT auto-create a
-- period — create_accounting_period is the only way a period comes into
-- existence, so a posting against a date with no covering period fails
-- clearly rather than silently provisioning one.
-- ---------------------------------------------------------------------------

create or replace function public.finance_resolve_period(
  p_workspace_id uuid,
  p_entry_date date
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period_id uuid;
begin
  select id into v_period_id
  from public.accounting_periods
  where workspace_id = p_workspace_id
    and period_start <= p_entry_date
    and period_end >= p_entry_date
  limit 1;

  if v_period_id is null then
    raise exception 'No accounting period covers % for this workspace. Create one with create_accounting_period first.', p_entry_date
      using errcode = 'P1101';
  end if;

  return v_period_id;
end;
$$;

comment on function public.finance_resolve_period(uuid, date) is
  'Resolves the accounting_periods row covering entry_date for a workspace. Raises P1101 if none exists — never auto-creates one.';

-- ---------------------------------------------------------------------------
-- finance_insert_journal_entry — the shared "insert a Journal Entry and its
-- lines atomically" helper every posting RPC composes. p_lines is a jsonb
-- array of {"account_id": uuid, "debit_minor": integer, "credit_minor":
-- integer, "line_memo": text (optional)} objects, already resolved by the
-- caller (via finance_resolve_account for system postings, or validated
-- directly for manual adjustments) — this helper does no account resolution
-- of its own, keeping it a narrow insert primitive rather than a second
-- place account-resolution logic could diverge.
--
-- Balance is NOT re-validated here — the deferred constraint trigger from
-- the Database Schema phase (finance_check_journal_entry_balanced) is the
-- single source of truth for that invariant and fires at transaction
-- commit regardless of which function performed the insert.
-- ---------------------------------------------------------------------------

create or replace function public.finance_insert_journal_entry(
  p_workspace_id uuid,
  p_entry_date date,
  p_source_type text,
  p_source_id text,
  p_memo text,
  p_posted_by text,
  p_reverses_entry_id uuid,
  p_posting_key text,
  p_lines jsonb
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period_id uuid;
  v_entry public.journal_entries;
  v_line jsonb;
  v_debit integer;
  v_credit integer;
begin
  v_period_id := public.finance_resolve_period(p_workspace_id, p_entry_date);

  insert into public.journal_entries (
    workspace_id, entry_date, accounting_period_id, source_type, source_id, memo, posted_by, reverses_entry_id, posting_key
  ) values (
    p_workspace_id, p_entry_date, v_period_id, p_source_type, p_source_id, p_memo, p_posted_by, p_reverses_entry_id, p_posting_key
  )
  returning * into v_entry;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_debit := coalesce((v_line->>'debit_minor')::integer, 0);
    v_credit := coalesce((v_line->>'credit_minor')::integer, 0);

    insert into public.journal_lines (
      journal_entry_id, workspace_id, account_id, debit_minor, credit_minor,
      amount_in_base_currency_minor, line_memo, line_order
    ) values (
      v_entry.id, p_workspace_id, (v_line->>'account_id')::uuid, v_debit, v_credit,
      greatest(v_debit, v_credit), v_line->>'line_memo', coalesce((v_line->>'line_order')::integer, 0)
    );
  end loop;

  return v_entry;
end;
$$;

comment on function public.finance_insert_journal_entry(uuid, date, text, text, text, text, uuid, text, jsonb) is
  'Inserts one journal_entries row and its journal_lines from a caller-resolved jsonb line array. Balance is enforced by the deferred trigger from the Database Schema phase, not re-checked here. p_posting_key is the system-level idempotency identifier (distinct from p_source_type/p_source_id, the business-source reference) — pass null for entries with no natural one-time-per-source key (e.g. Manual Adjustments).';
