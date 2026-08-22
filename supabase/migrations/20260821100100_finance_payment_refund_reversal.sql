-- Finance F1.8 migration 2 of 2: post_payment_refund_reversal, composed into
-- process_payment_refund.
--
-- Closes the second F1.7-disclosed gap: refundPayment() changed operational
-- Payment/Invoice state but never touched the ledger, so a settled payment's
-- refund left its original Dr Cash / Cr AR-or-Deposits entry standing
-- unreversed. F1.7 made this MORE consequential (not newly broken) by
-- making every succeeded payment reliably post in the first place; this
-- migration is the intentionally-deferred follow-up F1.7's own report named.
--
-- This is a PARTIAL, proportional reversal per refund event, NOT a call to
-- the existing whole-entry reverse_journal_entry (Posting Engine migration
-- 6): reverse_journal_entry swaps every line of the ORIGINAL entry and
-- allows at most one reversal ever (reversed_by_entry_id can only be set
-- once) — correct for "this entire entry was a mistake," wrong for "a
-- $250 refund against a $1,000 settlement, possibly one of several partial
-- refunds against the same original payment." reversed_by_entry_id /
-- reverses_entry_id are therefore deliberately left null on every entry
-- this migration posts — that column pair remains reserved exclusively for
-- reverse_journal_entry's whole-entry semantics; using it here would
-- incorrectly mark the original settlement as fully reversed after only a
-- partial refund, and would collide with reverse_journal_entry's own
-- "already reversed" guard for a future legitimate whole-entry correction.
--
-- Account routing is NOT re-derived from invoice_id (which would duplicate
-- post_payment_settlement's own routing logic in a second place it could
-- drift from). Instead the original settlement's ACTUAL posted lines are
-- read back from journal_lines and swapped — durable, structured, and
-- correct even in the hypothetical future where routing rules change,
-- since it reflects what was truly posted for THIS payment at settlement
-- time, not what today's routing rule would produce for it.
--
-- source_type = 'payment_refund' was already present in the
-- journal_entries_source_type_check constraint from the original Database
-- Schema phase (20260803100200) — this migration adds no new allowed
-- value, the schema already anticipated this feature. posting_key is
-- 'payment_refund:<refund_payment_id>' (the REFUND row's own id, never the
-- original payment's id) so that N legitimate partial refunds against one
-- original payment produce N distinct postings, never colliding on the
-- workspace_id+posting_key unique index — this is also why the pre-existing
-- (source_type, source_id) partial unique index (Database Schema phase)
-- already protects the same invariant without any change: source_id is
-- the refund row's own always-unique id.
--
-- Legacy-data safety (no historical backfill): if no 'payment_settlement'
-- journal entry exists for the original payment (it predates F1.7, or was
-- created via a path that never posted), this function fails visibly
-- (P1118) rather than inventing a reversal with no real entry to reverse.
-- The whole refund — operational AND ledger — rolls back together, since
-- this is composed via `perform` inside process_payment_refund's own
-- transaction, exactly like post_payment_settlement is composed into
-- record_payment_settlement.

create or replace function public.post_payment_refund_reversal(
  p_refund_payment_id uuid,
  p_original_payment_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_refund public.payments;
  v_settlement_entry public.journal_entries;
  v_cash_line public.journal_lines;
  v_credit_line public.journal_lines;
  v_posting_key text;
  v_entry public.journal_entries;
begin
  select * into v_refund from public.payments where id = p_refund_payment_id;
  if not found then
    raise exception 'Refund payment not found.' using errcode = 'P1111';
  end if;

  if exists (select 1 from public.journal_entries where source_type = 'payment_refund' and source_id = p_refund_payment_id::text) then
    raise exception 'This refund has already been posted.' using errcode = 'P1104';
  end if;

  select * into v_settlement_entry
  from public.journal_entries
  where workspace_id = v_refund.workspace_id
    and source_type = 'payment_settlement'
    and source_id = p_original_payment_id::text;

  if not found then
    raise exception 'No settlement entry exists for the original payment — cannot reverse. It predates ledger posting or was never settled; resolve via reconciliation, not an invented reversal.'
      using errcode = 'P1118';
  end if;

  select * into v_cash_line from public.journal_lines where journal_entry_id = v_settlement_entry.id and debit_minor > 0 limit 1;
  select * into v_credit_line from public.journal_lines where journal_entry_id = v_settlement_entry.id and credit_minor > 0 limit 1;

  if v_cash_line.id is null or v_credit_line.id is null then
    raise exception 'The original settlement entry is malformed — cannot determine accounts to reverse.' using errcode = 'P1118';
  end if;

  v_posting_key := 'payment_refund:' || p_refund_payment_id;

  v_entry := public.finance_insert_journal_entry(
    v_refund.workspace_id,
    v_refund.transaction_date,
    'payment_refund',
    p_refund_payment_id::text,
    'Refund reversal of payment settlement ' || v_settlement_entry.id::text || ' (' || v_refund.amount_minor::text || ' minor units)',
    p_actor,
    null,
    v_posting_key,
    jsonb_build_array(
      jsonb_build_object('account_id', v_credit_line.account_id, 'debit_minor', v_refund.amount_minor, 'credit_minor', 0),
      jsonb_build_object('account_id', v_cash_line.account_id, 'debit_minor', 0, 'credit_minor', v_refund.amount_minor)
    )
  );

  return v_entry;
end;
$$;

comment on function public.post_payment_refund_reversal(uuid, uuid, text) is
  'Posts a PARTIAL, proportional reversal of a payment settlement for one refund event: Dr [original credit account: 1100 AR or 2200 Customer Deposits] / Cr 1000 Cash, for the refund''s own amount_minor (not the full original settlement). Account routing is read back from the original settlement''s actual posted journal_lines, not re-derived. Fails with P1118 (never invents a reversal) if no payment_settlement entry exists for the original payment. Idempotent per refund row via posting_key ''payment_refund:<refund_payment_id>'' plus the pre-existing (source_type, source_id) unique index.';

-- Recreates process_payment_refund (originally 20260721100700) to compose
-- the reversal posting into its existing transaction — same signature, same
-- call site in the TypeScript repository (no change needed there), only its
-- body gains one new step. Every line above the new `perform` call is
-- unchanged from the original.

create or replace function public.process_payment_refund(
  p_original_payment_id uuid,
  p_amount_minor integer,
  p_actor text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_original public.payments;
  v_reference text;
  v_prior_refunds integer;
  v_refundable integer;
  v_refund public.payments;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a refund amount greater than zero.' using errcode = 'P0001';
  end if;

  select * into v_original from public.payments where id = p_original_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  if v_original.status not in ('succeeded', 'partially_refunded') then
    raise exception 'Cannot refund a payment that is %.', v_original.status using errcode = 'P0003';
  end if;

  v_reference := 'refund_of:' || v_original.id::text;

  select coalesce(sum(amount_minor), 0) into v_prior_refunds
  from public.payments
  where reference = v_reference
    and status in ('succeeded', 'partially_refunded', 'refunded');

  v_refundable := greatest(0, v_original.amount_minor - v_prior_refunds);

  if p_amount_minor > v_refundable then
    raise exception 'Cannot refund more than the refundable amount (% minor units remaining).', v_refundable
      using errcode = 'P0004';
  end if;

  insert into public.payments (
    workspace_id, invoice_id, client_id, event_id, contract_id,
    payment_type, status, amount_minor, currency, payment_method,
    reference, transaction_date, received_at, refunded_at, notes
  ) values (
    v_original.workspace_id, v_original.invoice_id, v_original.client_id, v_original.event_id, v_original.contract_id,
    'refund', 'succeeded', p_amount_minor, v_original.currency, v_original.payment_method,
    v_reference, (now() at time zone 'utc')::date, now(), now(),
    'Refund of payment ' || v_original.id::text || '.'
  )
  returning * into v_refund;

  update public.payments
  set status = case when (v_refundable - p_amount_minor) = 0 then 'refunded' else 'partially_refunded' end,
      refunded_at = now(),
      updated_at = now()
  where id = v_original.id;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (v_refund.workspace_id, 'payment', v_refund.id, 'payment_refunded', 'Payment refunded', p_actor);

  -- Finance F1.8: post the settlement reversal in the SAME transaction as
  -- the operational refund above. If no settlement entry exists (legacy
  -- payment) or posting otherwise fails, this raises and the whole
  -- transaction — refund row, original status change, and Timeline entry
  -- included — rolls back. The refund never commits without its reversal.
  perform public.post_payment_refund_reversal(v_refund.id, v_original.id, p_actor);

  return v_refund;
end;
$$;

comment on function public.process_payment_refund(uuid, integer, text) is
  'Atomic, row-locked equivalent of the mock''s refundPayment() — validates the refundable ceiling against prior refunds tracked via the reference convention, inserts the refund Payment, updates the original''s status, logs Timeline, and (Finance F1.8) posts the proportional settlement reversal via post_payment_refund_reversal — all in one transaction. Fails safely (P1118) rather than inventing a reversal for a payment with no settlement entry. Caller still calls recompute_invoice_balance() separately afterward if the original was invoice-linked, unchanged from before F1.8.';
