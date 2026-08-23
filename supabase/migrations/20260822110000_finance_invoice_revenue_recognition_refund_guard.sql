-- Finance F2.1B-REVIEW migration: refund-vs-Revenue-recognition safety
-- guard. Discovered during F2.1B's own Founder review, not part of the
-- originally-scoped 20260822100000 migration — a genuine correctness
-- defect F2.1B itself introduced in combination with the pre-existing
-- (unmodified) F1.8 refund-reversal RPC, not an F2.1C nice-to-have.
--
-- The defect: post_payment_refund_reversal (F1.8) reverses only the
-- SETTLEMENT entry (Dr Cash / Cr AR-or-Deposits) for a refund — it has no
-- knowledge of Revenue recognition and never touches account 4000. Traced
-- example: Invoice $100 issued (Dr AR 100 / Cr Revenue 100), paid in full
-- (Dr Cash 100 / Cr AR 100 -> AR back to 0), then fully refunded under the
-- CURRENT (pre-this-migration) implementation posts Dr AR 100 / Cr Cash 100
-- to reverse the settlement -- landing AR at +100 again and Revenue still
-- at +100, both of which are actively FALSE once the invoice has actually
-- been refunded (nothing is owed, no revenue was actually earned). This is
-- not a "temporarily incomplete" gap like the reconciliation/AR-Aging
-- deferrals -- it is a wrong, actionable number (a phantom receivable).
--
-- Minimum safe guard (not a fix -- Revenue-side refund correction remains
-- F2.1C scope): reject a refund outright, with a clear error, whenever the
-- original payment is invoice-linked AND that invoice has an unreversed
-- Revenue-recognition entry (source_type = 'invoice_issued'). Non-invoice-
-- linked (Customer Deposits) refunds are entirely unaffected -- no Revenue
-- was ever recognized for them, so their existing reversal remains correct
-- and safe exactly as before. New error code P1120, the next in the
-- existing P1100+ Posting Engine range (P1117-P1119 already claimed).
--
-- Functional impact, disclosed plainly: refunding any invoice-linked
-- payment against an invoice issued after F2.1B ships is blocked until
-- F2.1C provides the correction posting. This is a genuine, deliberate
-- regression in scope of the existing refund feature, accepted because the
-- alternative -- a silently false AR/Revenue balance -- is worse.

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

  -- Finance F2.1B-REVIEW guard: block before any mutation if Revenue was
  -- recognized for the linked invoice and has not itself been reversed
  -- (e.g. by voiding the invoice, which F2.1B already keeps consistent).
  if v_original.invoice_id is not null and exists (
    select 1 from public.journal_entries
    where source_type = 'invoice_issued'
      and source_id = v_original.invoice_id::text
      and reversed_by_entry_id is null
  ) then
    raise exception 'Cannot refund a payment linked to an invoice with recognized Revenue. This requires a dedicated correction flow not yet available.'
      using errcode = 'P1120';
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

  perform public.post_payment_refund_reversal(v_refund.id, v_original.id, p_actor);

  return v_refund;
end;
$$;

comment on function public.process_payment_refund(uuid, integer, text) is
  'Atomic, row-locked equivalent of the mock''s refundPayment() -- validates the refundable ceiling against prior refunds, inserts the refund Payment, updates the original''s status, logs Timeline, and posts the proportional settlement reversal via post_payment_refund_reversal -- all in one transaction. Finance F2.1B-REVIEW: rejects (P1120) refunding a payment linked to an invoice with unreversed recognized Revenue -- the existing settlement-only reversal would otherwise leave a phantom AR balance and an overstated Revenue balance. Fails safely (P1118) rather than inventing a reversal for a payment with no settlement entry, unchanged from F1.8.';
