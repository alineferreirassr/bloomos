-- Finance Posting Engine migration 6 of 9: reverse_journal_entry.
--
-- Widens journal_entries_source_type_check to add one new value: 'reversal'
-- — purely additive (every prior value is preserved), same widening
-- discipline every previous CHECK-constraint change in this schema has
-- used. A reversal's own source_type/source_id pair is
-- ('reversal', <id of the entry it reverses>) rather than reusing the
-- original's own source_type/source_id — reusing those would collide with
-- the general posting_key unique index for every source_type except
-- purchase_receipt/manual_adjustment (e.g. reversing a payment_settlement
-- entry would otherwise try to insert a second entry keyed on the same
-- payment_id). Using ('reversal', original_entry_id) instead gives a
-- reversal its own natural, always-available idempotency key — at most one
-- reversal may ever exist per original entry — while reverses_entry_id/
-- reversed_by_entry_id (already in the schema) remain the primary,
-- human-readable traversal columns.

alter table public.journal_entries drop constraint journal_entries_source_type_check;
alter table public.journal_entries
  add constraint journal_entries_source_type_check check (
    source_type in (
      'purchase_receipt', 'invoice_issued', 'invoice_voided', 'payment_settlement', 'payment_refund',
      'expense_due', 'expense_paid', 'expense_reimbursed', 'expense_due_reversal',
      'inventory_adjustment', 'inventory_writeoff', 'inventory_event_checkout', 'inventory_event_return',
      'inventory_initial_stock', 'vendor_payment', 'vendor_refund', 'stripe_payout', 'manual_adjustment',
      'reversal'
    )
  );

-- ---------------------------------------------------------------------------
-- reverse_journal_entry(p_journal_entry_id, p_reason, p_actor) — creates a
-- new entry with every line's debit/credit swapped, never edits the
-- original's financial values. Concurrency-safe via a row lock on the
-- target entry: two concurrent reversal attempts for the same entry
-- serialize on that lock, and the second call's
-- reversed_by_entry_id-is-not-null check (evaluated after acquiring the
-- lock, once the first call's transaction has committed or rolled back)
-- correctly rejects the second attempt rather than racing past it.
--
-- Locked-period protection is inherited entirely from the existing
-- finance_check_period_open_for_posting trigger (Database Schema phase) —
-- it already rejects ANY insert into a locked period unconditionally, and
-- allows a reversal (reverses_entry_id is not null) into a closed period.
-- This function always targets today's date, which resolves via
-- finance_resolve_period to the current open period in the normal case —
-- "post into the current eligible open period" is satisfied by that
-- default; the trigger's own closed-period allowance for reversals remains
-- available to any future caller that explicitly needs to backdate one,
-- without this function needing its own separate override parameter.
-- ---------------------------------------------------------------------------

create or replace function public.reverse_journal_entry(
  p_journal_entry_id uuid,
  p_reason text,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_original public.journal_entries;
  v_reversal public.journal_entries;
  v_reversed_lines jsonb;
  v_posting_key text;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reversal reason is required.' using errcode = 'P1112';
  end if;

  select * into v_original from public.journal_entries where id = p_journal_entry_id for update;
  if not found then
    raise exception 'Journal entry not found.' using errcode = 'P1111';
  end if;

  if v_original.reversed_by_entry_id is not null then
    raise exception 'This journal entry has already been reversed.' using errcode = 'P1109';
  end if;

  select jsonb_agg(
    jsonb_build_object(
      'account_id', account_id,
      'debit_minor', credit_minor,
      'credit_minor', debit_minor,
      'line_memo', line_memo,
      'line_order', line_order
    )
  )
  into v_reversed_lines
  from public.journal_lines
  where journal_entry_id = p_journal_entry_id;

  v_posting_key := 'reversal:' || p_journal_entry_id;

  v_reversal := public.finance_insert_journal_entry(
    v_original.workspace_id,
    (now() at time zone 'utc')::date,
    'reversal',
    p_journal_entry_id::text,
    p_reason,
    p_actor,
    p_journal_entry_id,
    v_posting_key,
    v_reversed_lines
  );

  update public.journal_entries
  set reversed_by_entry_id = v_reversal.id
  where id = p_journal_entry_id;

  return v_reversal;
end;
$$;

comment on function public.reverse_journal_entry(uuid, text, text) is
  'Creates a new reversing entry with every line''s debit/credit swapped, sets reverses_entry_id on the new entry and reversed_by_entry_id on the original — never edits the original''s financial values. Rejects reversing an already-reversed entry (P1109) or a blank reason (P1112). Locked/closed-period protection is inherited from the existing period-protection trigger. Carries a deterministic posting_key (reversal:<original_journal_entry_id>) alongside its existing (source_type, source_id) = (''reversal'', original_journal_entry_id) natural key.';
