-- Finance F1.8 migration 1 of 2: mark_payment_succeeded_and_post_settlement.
--
-- Closes the atomicity gap F1.7 explicitly disclosed and left open: the
-- Repository layer's markPaymentSucceeded() did a status UPDATE, then a
-- SEPARATE best-effort post_payment_settlement RPC call, with no shared
-- transaction — a posting failure left a Payment persisted as "succeeded"
-- with no settlement journal entry, surfaced only via an Audit Log entry a
-- human had to notice and act on.
--
-- Same composition pattern record_expense_transition already established
-- (validate the transition, UPDATE status, `perform` the existing posting
-- RPC — all inside one plpgsql function, so Postgres's own transaction
-- semantics make the whole thing atomic: any exception anywhere in this
-- function rolls back everything, including the status UPDATE and the
-- invoice balance recompute). No new posting primitive is introduced here —
-- this composes the EXISTING post_payment_settlement (migration
-- 20260804100200) exactly as record_payment_settlement already does for the
-- create-time path, so the two paths that can cause a Payment to become
-- "succeeded" (create-time and transition-time) now share the identical
-- posting call, not two implementations that could drift.
--
-- Overpayment validation (amount_minor > invoice balance_minor) is
-- deliberately NOT duplicated into this RPC: record_payment_settlement (the
-- sibling create-time RPC) doesn't enforce it in SQL either — it has only
-- ever lived in the TypeScript Repository layer (createPayment/
-- markPaymentSucceeded both re-check it before calling into the RPC layer).
-- Adding a SQL-side copy here would be a second, disconnected place that
-- business rule could drift from the TS copy — out of this migration's
-- narrow scope (closing the POSTING atomicity gap, not relocating existing
-- business validation). The TypeScript repository still performs this check
-- before calling this RPC, exactly as it does today.
--
-- Idempotency / retry safety: a repeated call against an already-succeeded
-- Payment is REJECTED (P1105, "cannot mark succeeded payment as succeeded"),
-- mirroring both record_expense_transition's own established pattern (which
-- also rejects an invalid-state transition rather than silently no-op-ing)
-- and canTransitionPaymentStatus()'s pre-existing TypeScript rule (pending/
-- processing -> succeeded only). Because this check runs BEFORE any write
-- and BEFORE the underlying post_payment_settlement call, a retry never
-- reaches the posting step at all — "no second journal entry" is
-- guaranteed by construction, not merely by post_payment_settlement's own
-- (source_type, source_id) duplicate guard as a backstop.

create or replace function public.mark_payment_succeeded_and_post_settlement(
  p_payment_id uuid,
  p_actor text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P1111';
  end if;

  if v_payment.status not in ('pending', 'processing') then
    raise exception 'Cannot mark % payment as succeeded.', v_payment.status using errcode = 'P1105';
  end if;

  update public.payments
  set status = 'succeeded', received_at = now(), updated_at = now()
  where id = p_payment_id
  returning * into v_payment;

  if v_payment.invoice_id is not null then
    perform public.recompute_invoice_balance(v_payment.invoice_id, p_actor);
  end if;

  perform public.post_payment_settlement(p_payment_id, p_actor);

  return v_payment;
end;
$$;

comment on function public.mark_payment_succeeded_and_post_settlement(uuid, text) is
  'The atomic version of markPaymentSucceeded: validates the pending/processing -> succeeded transition, updates status, recomputes the linked Invoice balance (if any), and posts the settlement via the existing post_payment_settlement — all in one transaction. A posting failure rolls back the status update too, closing the F1.7-disclosed gap where a Payment could persist as succeeded with no settlement entry. Rejects a retry against an already-succeeded Payment (P1105) before ever attempting to post again.';
