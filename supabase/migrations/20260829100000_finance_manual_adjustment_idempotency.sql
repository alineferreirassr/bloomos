-- Finance F2.1C-F-D-C: Manual Adjustment request idempotency.
--
-- Founder decision (F2.1C-F-D-A, Option B): a UI-only fix is not accepted as
-- sufficient — Manual Adjustment must distinguish a retry of the SAME
-- logical request from a NEW intentional adjustment using explicit durable
-- request identity, exactly like every other Finance mutation this schema
-- already protects (record_deposit_application, process_payment_refund,
-- record_deposit_application_reversal, record_invoice_adjustment,
-- void_invoice_and_reverse_revenue_recognition's Partial-Payment Void path).
--
-- WHY posting_key ALONE, NOT source_id (unlike Invoice Adjustment/Partial
-- Void, which key their replay lookup on source_id): journal_entries'
-- own journal_entries_source_consistency_check hard-requires
-- (source_id is null) = (source_type = 'manual_adjustment') — source_id
-- must stay null for every Manual Adjustment row, today and after this
-- migration. Widening that constraint was evaluated and rejected as
-- unnecessary risk for this fix: the existing partial unique index
-- journal_entries_workspace_posting_key_unique on (workspace_id,
-- posting_key) where posting_key is not null already gives Manual
-- Adjustment everything a request-idempotency mechanism needs, the moment
-- it starts passing a non-null, deterministic posting_key instead of always
-- passing null. No new table, column, index, RLS policy, or constraint is
-- introduced by this migration — source_type, source_id, and every
-- accounting/balance/period rule are byte-for-byte unchanged.
--
-- WHY NOT encode the replay target in memo (unlike Invoice Adjustment's
-- technique): memo here is genuine Founder-authored free text (a required
-- field the Founder types and later reads back on the Journal Entry), not a
-- system-composed string — appending a hidden comparison fingerprint to it
-- would corrupt what the Founder actually wrote. Instead, the durable
-- replay target is reconstructed directly from the existing entry's own
-- already-persisted, append-only entry_date/memo columns plus its own
-- journal_lines rows (ordered by line_order) — never from mutable external
-- state (e.g. current chart_of_accounts metadata), and never re-serialized
-- into any field.
--
-- REPLAY SEMANTICS (same p_manual_adjustment_id):
--   same entry_date + memo + ordered lines (account_id/debit_minor/
--     credit_minor/line_memo per line) -> returns the existing Journal
--     Entry unchanged, no second entry, no second lines.
--   any of those differing                -> P1129, no mutation.
--   a DIFFERENT p_manual_adjustment_id with an IDENTICAL payload always
--     creates a new, independent, fully legitimate Manual Adjustment --
--     two genuinely identical adjustments are a real, common Founder
--     action (e.g. two separate identical corrections on different days'
--     books) and must never be silently merged or blocked.
--
-- CONCURRENCY: Manual Adjustment has no natural parent domain row to lock
-- before the replay check (unlike Refund/Deposit Application/Reversal,
-- which lock the target payment/invoice row first) -- it is a freestanding
-- Journal Entry with nothing pre-existing to act upon. The pre-existing
-- journal_entries_workspace_posting_key_unique index remains the absolute
-- backstop regardless: two concurrent requests sharing the exact same
-- p_manual_adjustment_id can never both commit a row, because the second
-- INSERT would violate that unique index even in the vanishingly rare case
-- where both transactions passed the replay lookup as "not found" before
-- either committed. No exception handler is added for this (matching this
-- migration set's own established "no exception handlers" convention) --
-- the losing transaction surfaces a raw Postgres uniqueness error rather
-- than the friendly P1129 message in that one narrow race, which is a
-- cosmetic difference only: no financial duplication is possible either
-- way, and the existing generic UI thrown-exception resilience (safe
-- fallback, preserved form, safe retry) absorbs it cleanly -- a subsequent
-- retry with the same id finds the now-committed row via the same replay
-- lookup and returns it.
--
-- ERROR CODES: reuses the existing, already-registered P1129 (idempotency
-- key reused for a different payload) / P1130 (required key missing) pair
-- verbatim -- both are already members of the single shared
-- FINANCE_VALIDATION_ERROR_CODES set the TypeScript repository layer uses,
-- so no error-registry change is needed anywhere.
--
-- Scope boundary: does not touch RLS, policies, table columns, or any
-- constraint. Does not widen journal_entries_source_type_check (already
-- includes 'manual_adjustment'). Does not edit any already-pushed
-- migration -- this file only redefines record_manual_adjustment via
-- create or replace, per this whole project's "never edit an
-- already-pushed migration" discipline.

create or replace function public.record_manual_adjustment(
  p_workspace_id uuid,
  p_entry_date date,
  p_memo text,
  p_lines jsonb,
  p_actor text,
  p_manual_adjustment_id uuid
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_line_count integer := 0;
  v_total_debit integer := 0;
  v_total_credit integer := 0;
  v_debit integer;
  v_credit integer;
  v_account_id uuid;
  v_account public.chart_of_accounts;
  v_entry public.journal_entries;
  v_posting_key text;
  v_existing_entry public.journal_entries;
  v_existing_lines jsonb;
  v_incoming_lines jsonb;
begin
  if p_manual_adjustment_id is null then
    raise exception 'p_manual_adjustment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same manual adjustment request).'
      using errcode = 'P1130';
  end if;

  if p_memo is null or btrim(p_memo) = '' then
    raise exception 'A memo is required for a manual adjustment.' using errcode = 'P1113';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) < 2 then
    raise exception 'A manual adjustment requires at least two lines.' using errcode = 'P1114';
  end if;

  v_posting_key := 'manual_adjustment:' || p_manual_adjustment_id;

  -- Request-level idempotency: checked before any account/balance
  -- validation (which could spuriously fail against CURRENT chart-of-
  -- accounts state on a replay) — same convention as every other Finance
  -- idempotency-key check in this migration set. source_id stays null
  -- (journal_entries_source_consistency_check), so the lookup is by
  -- posting_key alone, never by source_id.
  select * into v_existing_entry
  from public.journal_entries
  where workspace_id = p_workspace_id and posting_key = v_posting_key;

  if found then
    select jsonb_agg(jsonb_build_object(
             'account_id', account_id, 'debit_minor', debit_minor,
             'credit_minor', credit_minor, 'line_memo', line_memo
           ) order by line_order)
      into v_existing_lines
      from public.journal_lines
      where journal_entry_id = v_existing_entry.id;

    select jsonb_agg(jsonb_build_object(
             'account_id', (v_line->>'account_id')::uuid,
             'debit_minor', coalesce((v_line->>'debit_minor')::integer, 0),
             'credit_minor', coalesce((v_line->>'credit_minor')::integer, 0),
             'line_memo', nullif(v_line->>'line_memo', '')
           ) order by coalesce((v_line->>'line_order')::integer, 0))
      into v_incoming_lines
      from jsonb_array_elements(p_lines) as v_line;

    if v_existing_entry.entry_date = p_entry_date
      and v_existing_entry.memo = p_memo
      and v_existing_lines = v_incoming_lines
    then
      return v_existing_entry;
    end if;

    raise exception 'This idempotency key was already used for a different manual adjustment request.' using errcode = 'P1129';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_count := v_line_count + 1;
    v_debit := coalesce((v_line->>'debit_minor')::integer, 0);
    v_credit := coalesce((v_line->>'credit_minor')::integer, 0);
    v_account_id := (v_line->>'account_id')::uuid;

    if (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'Line % must have exactly one of debit_minor or credit_minor positive.', v_line_count
        using errcode = 'P1115';
    end if;

    select * into v_account from public.chart_of_accounts where id = v_account_id;
    if not found then
      raise exception 'Line % references an account that does not exist.', v_line_count using errcode = 'P1111';
    end if;

    if v_account.workspace_id <> p_workspace_id then
      raise exception 'Line % references an account from a different workspace.', v_line_count using errcode = 'P1107';
    end if;

    if v_account.archived_at is not null then
      raise exception 'Line % references archived account "%".', v_line_count, v_account.name using errcode = 'P1108';
    end if;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception 'Manual adjustment is not balanced: total debits % do not equal total credits %.',
      v_total_debit, v_total_credit using errcode = 'P1106';
  end if;

  v_entry := public.finance_insert_journal_entry(
    p_workspace_id, p_entry_date, 'manual_adjustment', null, p_memo, p_actor, null, v_posting_key, p_lines
  );

  return v_entry;
end;
$$;

comment on function public.record_manual_adjustment(uuid, date, text, jsonb, text, uuid) is
  'Creates a balanced manual Journal Entry from caller-supplied lines (real account_id values, not resolved by number). Requires a nonblank memo, at least 2 lines, exactly one nonzero side per line, matching total debits/credits, and every account to belong to the given workspace and not be archived. Never auto-balances or adds a plug line. Finance F2.1C-F-D-C: p_manual_adjustment_id is a REQUIRED (P1130 if null) request-level idempotency key carried as posting_key = manual_adjustment:<id> (source_id stays permanently null per journal_entries_source_consistency_check) — a repeat call with the same key and the same entry_date/memo/lines payload (compared against the existing entry''s own persisted journal_lines, never mutable external state) replays the original Journal Entry with no re-mutation; a repeat with a different payload is rejected (P1129). A different key with an identical payload always creates a new, independent, legitimate Manual Adjustment.';
