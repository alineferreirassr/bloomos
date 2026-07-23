-- Finance Posting Engine migration 3 of 9: post_payment_settlement +
-- record_payment_settlement.
--
-- Unlike Purchases/Inventory, Payments has no pre-existing "owning
-- mutation" RPC to compose into — createPayment/markPaymentSucceeded are
-- plain repository INSERT/UPDATE calls today (see recompute_invoice_
-- balance's own comment). Since the goal requires posting to run in the
-- SAME transaction as the owning payment mutation, and no such transaction
-- exists yet for a manually recorded payment, record_payment_settlement is
-- introduced here as that owning mutation — a pure database RPC, not
-- Finance Repository work (the TypeScript `lib/data/finance/*` layer is
-- untouched; nothing calls this new RPC yet). It follows the exact
-- precedent process_payment_refund already set: a security-invoker
-- function that inserts a new `payments` row directly.
--
-- post_payment_settlement(p_payment_id, p_actor) is the standalone,
-- idempotent-per-payment-row posting function named in the brief. It locks
-- the payment row (protecting against a concurrent second call for the same
-- id), pre-checks for an existing posting (source_type = 'payment_settlement'
-- already participates in the general posting_key partial unique index from
-- the Database Schema phase — this is a one-time-per-payment event, unlike
-- purchase_receipt), and posts:
--   invoice-linked: Debit 1000 Cash, Credit 1100 Accounts Receivable
--   unapplied deposit (no invoice_id): Debit 1000 Cash, Credit 2200
--     Customer Deposits / Unearned Revenue
--
-- Only manual/internal payment methods are accepted in this phase —
-- payment_method = 'stripe' is rejected with a clear domain error (P1117),
-- even though the existing payments_payment_method_check CHECK constraint
-- still allows the value at the column level (that constraint is shared,
-- pre-existing, and not modified here). No Stripe Clearing account (1010)
-- is ever used by this function.

create or replace function public.post_payment_settlement(
  p_payment_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_credit_account public.chart_of_accounts;
  v_posting_key text;
  v_entry public.journal_entries;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P1111';
  end if;

  if exists (select 1 from public.journal_entries where source_type = 'payment_settlement' and source_id = p_payment_id::text) then
    raise exception 'This payment has already been posted.' using errcode = 'P1104';
  end if;

  v_posting_key := 'payment_settlement:' || p_payment_id;

  if v_payment.invoice_id is not null then
    v_credit_account := public.finance_resolve_account(v_payment.workspace_id, 1100);
  else
    v_credit_account := public.finance_resolve_account(v_payment.workspace_id, 2200);
  end if;

  v_entry := public.finance_insert_journal_entry(
    v_payment.workspace_id,
    v_payment.transaction_date,
    'payment_settlement',
    p_payment_id::text,
    'Payment settlement (' || v_payment.payment_type || ', ' || v_payment.payment_method || ')',
    p_actor,
    null,
    v_posting_key,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_payment.workspace_id, 1000)).id,
        'debit_minor', v_payment.amount_minor, 'credit_minor', 0
      ),
      jsonb_build_object('account_id', v_credit_account.id, 'debit_minor', 0, 'credit_minor', v_payment.amount_minor)
    )
  );

  return v_entry;
end;
$$;

comment on function public.post_payment_settlement(uuid, text) is
  'Posts a manually recorded successful payment: Debit 1000 Cash, Credit 1100 Accounts Receivable (invoice-linked) or 2200 Customer Deposits/Unearned Revenue (unapplied deposit). Never uses 1010 Stripe Clearing — Stripe is deferred. Idempotent per payment_id via the existing source_type/source_id unique index plus a row lock; also carries a deterministic posting_key (payment_settlement:<payment_id>) for the newer workspace-scoped idempotency mechanism.';

create or replace function public.record_payment_settlement(
  p_workspace_id uuid,
  p_invoice_id uuid,
  p_client_id uuid,
  p_event_id uuid,
  p_contract_id uuid,
  p_payment_type text,
  p_amount_minor integer,
  p_currency text,
  p_payment_method text,
  p_reference text,
  p_transaction_date date,
  p_notes text,
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
  if p_payment_method = 'stripe' then
    raise exception 'Stripe payments are not supported in this phase — record only manual/internal payment methods.'
      using errcode = 'P1117';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a payment amount greater than zero.' using errcode = 'P1111';
  end if;

  insert into public.payments (
    workspace_id, invoice_id, client_id, event_id, contract_id,
    payment_type, status, amount_minor, currency, payment_method,
    reference, transaction_date, received_at, notes
  ) values (
    p_workspace_id, p_invoice_id, p_client_id, p_event_id, p_contract_id,
    p_payment_type, 'succeeded', p_amount_minor, p_currency, p_payment_method,
    p_reference, p_transaction_date, now(), p_notes
  )
  returning * into v_payment;

  if p_invoice_id is not null then
    perform public.recompute_invoice_balance(p_invoice_id, p_actor);
  end if;

  perform public.post_payment_settlement(v_payment.id, p_actor);

  return v_payment;
end;
$$;

comment on function public.record_payment_settlement(uuid, uuid, uuid, uuid, uuid, text, integer, text, text, text, date, text, text) is
  'The owning payment mutation post_payment_settlement composes into: inserts a succeeded Payment row, recomputes the linked Invoice''s balance (if any) via the existing recompute_invoice_balance(), and posts the settlement — all in one transaction. Rejects payment_method = ''stripe'' (Stripe is deferred to its own phase).';
