-- Finance F2.1C-C migration: Customer Deposit → Invoice application.
--
-- Approved architecture (F2.1C-A): a non-invoice-linked Payment (a
-- "Customer Deposit", invoice_id is null) posts Dr 1000 Cash / Cr 2200
-- Customer Deposits on settlement. Applying that deposit to an Invoice
-- must NOT move Cash again -- Cash already moved when the deposit was
-- collected. The application posts:
--
--   Dr 2200 Customer Deposits   application amount
--   Cr 1100 Accounts Receivable application amount
--
-- The application itself is represented as a new, system-generated,
-- already-succeeded Payment row linked to the target Invoice (mirrors the
-- refund_of:<id> convention exactly):
--
--   payment_type   = 'adjustment'  -- an internal reallocation, not a new
--                                     cash inflow; already an allowed
--                                     payments_payment_type_check value,
--                                     no schema widening needed.
--   payment_method = 'other'       -- never impersonates an externally-
--                                     settled card/bank payment method;
--                                     already an allowed
--                                     payments_payment_method_check value.
--   status         = 'succeeded'
--   reference      = 'deposit_application_of:<deposit_payment_id>'
--
-- Posting identity: source_type='deposit_application' (NEW -- requires
-- widening journal_entries_source_type_check, the same drop/add pattern
-- the 'reversal' source_type used), source_id=<application_payment_id>,
-- posting_key='deposit_application:<application_payment_id>' -- exactly
-- the established <source_type>:<source_id-that-is-unique-per-posting-
-- event> convention, so N applications of one deposit never collide.
--
-- Finance F2.1C-C-IDEMPOTENCY: application_payment_id is no longer an
-- internally-generated row id -- it is now a REQUIRED, CALLER-SUPPLIED
-- request-level idempotency key (p_application_payment_id), reusing the
-- established record_purchase_receipt / p_receipt_event_id convention
-- (20260804100100_finance_post_purchase_receipt.sql) rather than inventing
-- a parallel mechanism. A repeat call with the SAME key and the SAME
-- (deposit, invoice, amount) payload is a REPLAY -- returns the original
-- application Payment unchanged, no re-mutation. A repeat with the same
-- key but a DIFFERENT payload is a genuine conflict (P1129), not a valid
-- replay. This is layered ABOVE the existing posting_key idempotency
-- (which still prevents duplicate Journal Entry posting for an
-- already-existing application row) -- the two are distinct: REQUEST
-- idempotency (this layer) prevents a duplicate business mutation from
-- ever being created; POSTING idempotency (unchanged, in post_deposit_
-- application) prevents duplicate posting for a row that already exists.
--
-- Two functions, mirroring the post_payment_refund_reversal /
-- process_payment_refund split exactly:
--
--   post_deposit_application  -- posts the fixed 2-line entry for an
--   ALREADY-VALIDATED, already-inserted application Payment row. Does not
--   re-validate the application ceiling -- that happened in the owning
--   RPC before the row was inserted, exactly mirroring how post_payment_
--   refund_reversal trusts process_payment_refund's prior validation.
--
--   record_deposit_application  -- the atomic owning RPC. Locks the
--   deposit Payment row and the target Invoice row (in that order --
--   payments-row-then-invoices-row, the SAME order F2.1C-B-REVIEW
--   established for the refund-vs-Revenue-correction path, so no new
--   lock-order cycle is introduced), validates every condition below,
--   computes the available-deposit ceiling, inserts the application
--   Payment row, composes post_deposit_application, recomputes the
--   Invoice balance, and returns the application Payment.
--
-- Available deposit balance (Phase 3):
--
--   available_deposit_minor =
--     deposit.amount_minor
--     - sum(prior completed refunds of this deposit,   reference = 'refund_of:<deposit_id>')
--     - sum(prior completed applications of this deposit, reference = 'deposit_application_of:<deposit_id>')
--
-- "completed" = status in ('succeeded','partially_refunded','refunded'),
-- the same PAYMENT_STATUSES_COUNTING_TOWARD_PAID set every other ceiling
-- in this domain already uses. This is symmetric with Phase 10's
-- companion fix below: the REFUND ceiling must now also subtract prior
-- deposit applications, or a deposit could be refunded AND applied for
-- more than it ever held. Concretely: deposit=100000, applied 40000,
-- refunded 10000 -> refundable must be 50000 (100000-40000-10000), not
-- 90000 (100000-10000, ignoring the application) -- process_payment_
-- refund is redefined below to subtract both.
--
-- Validation (Phase 2), each with its own distinct P11xx code so a caller
-- can tell exactly which condition failed, matching this domain's
-- existing one-code-per-condition convention:
--
--   P1128  amount_minor is null or <= 0
--   P1111  deposit payment not found / invoice not found (reused -- same
--          established "missing source document" meaning as every other
--          use of P1111 in this file set, message text distinguishes)
--   P1124  source payment is not an unapplied Customer Deposit (its own
--          invoice_id is not null, or its status is not succeeded/
--          partially_refunded -- the same refundable-equivalent set
--          isPaymentRefundable already uses, since "can still be
--          consumed" is the same condition for refund and application)
--   P1125  deposit and invoice belong to different workspaces or clients
--   P1126  deposit currency does not match invoice currency
--   P1127  invoice is not in an application-eligible status (must be
--          issued/sent/viewed/partially_paid/overdue -- Revenue must
--          already be recognized (excludes draft) and the invoice must
--          not already be fully settled or dead (excludes paid/voided/
--          archived), mirroring void_invoice_and_reverse_revenue_
--          recognition's own explicit status-list convention)
--   P1122  amount exceeds the available deposit balance
--   P1123  amount exceeds the invoice's own outstanding balance_minor
--          (prevents a deposit application from silently over-paying an
--          invoice past what it actually owes -- recompute_invoice_
--          balance floors paid_minor's effect at balance_minor=0, which
--          would otherwise hide an accounting error rather than reject it)
--   P1104  duplicate posting (idempotency guard in post_deposit_
--          application, same convention as every other posting function)
--   P1118  no settlement entry exists for the deposit payment (reused --
--          post_deposit_application's own guard, added in review, mirrors
--          post_payment_refund_reversal's identical check: the eligibility
--          check above proves the source LOOKS like a Customer Deposit but
--          never proves Cash actually moved into 2200 for it)
--   P1130  p_application_payment_id is null (the request-level idempotency
--          key is required, no default -- same convention as P1130's
--          twin use in process_payment_refund below)
--   P1129  the SAME p_application_payment_id was already used for a
--          DIFFERENT (deposit, invoice, amount) payload -- a genuine
--          idempotency-key conflict, not a valid replay
--
-- Accounting scope (Phase 13): only 2200 and 1100 are ever touched by
-- post_deposit_application. Revenue (4000), Refunds & Returns (4950),
-- Sales Discounts (4900), Sales Tax Payable (2100), and Cash (1000) are
-- never referenced -- Revenue was already recognized at Invoice issuance;
-- applying a deposit is a pure balance-sheet reallocation between two
-- liability/asset accounts, never a P&L event.
--
-- Application reversal (Phase 11): NOT implemented in this migration.
-- reverse_journal_entry could reverse the deposit_application Journal
-- Entry alone, but that would desync the application Payment's status
-- (still 'succeeded', still counted by recompute_invoice_balance) from
-- the reversed ledger -- a misleading partial capability the F2.1C-C
-- brief explicitly says not to ship. A complete, safe reversal needs
-- either a new Payment status (payments_status_check widening) or a
-- dedicated reversal-Payment mechanism (mirroring how refunds get their
-- own Payment row) -- a larger domain decision deferred to a future,
-- explicitly-scoped checkpoint, the same "guard and defer" discipline
-- already applied to void-after-partial-payment (F2.1C-D).

alter table public.journal_entries drop constraint journal_entries_source_type_check;
alter table public.journal_entries
  add constraint journal_entries_source_type_check check (
    source_type in (
      'purchase_receipt', 'invoice_issued', 'invoice_voided', 'payment_settlement', 'payment_refund',
      'expense_due', 'expense_paid', 'expense_reimbursed', 'expense_due_reversal',
      'inventory_adjustment', 'inventory_writeoff', 'inventory_event_checkout', 'inventory_event_return',
      'inventory_initial_stock', 'vendor_payment', 'vendor_refund', 'stripe_payout', 'manual_adjustment',
      'reversal', 'deposit_application'
    )
  );

create or replace function public.post_deposit_application(
  p_application_payment_id uuid,
  p_deposit_payment_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_application public.payments;
  v_posting_key text;
  v_entry public.journal_entries;
begin
  select * into v_application from public.payments where id = p_application_payment_id;
  if not found then
    raise exception 'Deposit application payment not found.' using errcode = 'P1111';
  end if;

  if exists (
    select 1 from public.journal_entries
    where source_type = 'deposit_application' and source_id = p_application_payment_id::text
  ) then
    raise exception 'This deposit application has already been posted.' using errcode = 'P1104';
  end if;

  -- Finance F2.1C-C-REVIEW: mirrors post_payment_refund_reversal's P1118
  -- guard exactly -- record_deposit_application's own eligibility check
  -- (invoice_id is null + status succeeded/partially_refunded) proves the
  -- source LOOKS like a Customer Deposit, but never proves Cash actually
  -- moved into 2200 for it. Fails safely rather than inventing an
  -- application against a deposit that predates ledger posting or was
  -- never settled.
  if not exists (
    select 1 from public.journal_entries
    where source_type = 'payment_settlement' and source_id = p_deposit_payment_id::text
  ) then
    raise exception 'No settlement entry exists for the deposit payment — cannot apply. It predates ledger posting or was never settled; resolve via reconciliation, not an invented application.'
      using errcode = 'P1118';
  end if;

  v_posting_key := 'deposit_application:' || p_application_payment_id;

  v_entry := public.finance_insert_journal_entry(
    v_application.workspace_id,
    v_application.transaction_date,
    'deposit_application',
    p_application_payment_id::text,
    'Customer Deposit applied to invoice (deposit ' || p_deposit_payment_id::text || ')',
    p_actor,
    null,
    v_posting_key,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_application.workspace_id, 2200)).id,
        'debit_minor', v_application.amount_minor, 'credit_minor', 0
      ),
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_application.workspace_id, 1100)).id,
        'debit_minor', 0, 'credit_minor', v_application.amount_minor
      )
    )
  );

  return v_entry;
end;
$$;

comment on function public.post_deposit_application(uuid, uuid, text) is
  'Posts Dr 2200 Customer Deposits / Cr 1100 Accounts Receivable for one deposit-application event, for an ALREADY-VALIDATED, already-inserted application Payment row -- does not re-validate the application ceiling itself (record_deposit_application already enforced it before inserting the row), mirroring how post_payment_refund_reversal trusts process_payment_refund. No Cash line, no Revenue-affecting account touched. Idempotent per application row via posting_key ''deposit_application:<application_payment_id>'', errcode P1104 on retry. Fails with P1118 (never invents an application) if no payment_settlement entry exists for the deposit payment, mirroring post_payment_refund_reversal''s identical guard.';

create or replace function public.record_deposit_application(
  p_deposit_payment_id uuid,
  p_invoice_id uuid,
  p_amount_minor integer,
  p_application_payment_id uuid,
  p_actor text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_deposit public.payments;
  v_invoice public.invoices;
  v_existing public.payments;
  v_reference text;
  v_prior_refunds integer;
  v_prior_applications integer;
  v_available integer;
  v_application public.payments;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a deposit application amount greater than zero.' using errcode = 'P1128';
  end if;

  -- Finance F2.1C-C-IDEMPOTENCY: p_application_payment_id is now the
  -- REQUEST-level idempotency identity, not merely an internally-generated
  -- row id -- required (no default), matching the established
  -- record_purchase_receipt / p_receipt_event_id convention exactly (see
  -- 20260804100100_finance_post_purchase_receipt.sql). The caller must
  -- supply the SAME value on every retry of the same logical "apply this
  -- deposit to this invoice for this amount" request.
  if p_application_payment_id is null then
    raise exception 'p_application_payment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same deposit application request).'
      using errcode = 'P1130';
  end if;

  -- Lock order: deposit Payment row, then Invoice row -- the SAME order
  -- F2.1C-B-REVIEW established for the refund-vs-Revenue-correction path
  -- (process_payment_refund locks its payments row before post_payment_
  -- refund_reversal locks the invoice row), so no new lock-order cycle is
  -- introduced between the refund and application code paths.
  select * into v_deposit from public.payments where id = p_deposit_payment_id for update;
  if not found then
    raise exception 'Deposit payment not found.' using errcode = 'P1111';
  end if;

  -- Request-level idempotency: a repeat of the SAME p_application_payment_id
  -- is a REPLAY of an already-completed request, not a new mutation --
  -- return the existing application Payment unchanged, without re-running
  -- any validation below (which could spuriously fail against CURRENT state
  -- that has moved on since the original, already-successful call, e.g. the
  -- invoice's balance_minor). A payload mismatch (same key, different
  -- deposit/invoice/amount) is a genuine conflict, not a valid replay --
  -- checked BEFORE returning, never silently replayed for a different
  -- request. The v_deposit row lock above already serializes concurrent
  -- retries of the SAME logical request (same p_deposit_payment_id), so no
  -- additional lock is needed here — same reasoning as post_purchase_
  -- receipt's own concurrency note. The payments.id primary key constraint
  -- is the final, unconditional database-level backstop for the residual
  -- (adversarial-caller-only) case of the same key reused across genuinely
  -- different deposits, which cannot share this lock.
  v_reference := 'deposit_application_of:' || v_deposit.id::text;
  select * into v_existing from public.payments where id = p_application_payment_id;
  if found then
    if v_existing.reference is distinct from v_reference or v_existing.invoice_id is distinct from p_invoice_id or v_existing.amount_minor <> p_amount_minor then
      raise exception 'This idempotency key was already used for a different deposit application request.' using errcode = 'P1129';
    end if;
    return v_existing;
  end if;

  if v_deposit.invoice_id is not null then
    raise exception 'This payment is already linked to an invoice and is not an unapplied Customer Deposit.' using errcode = 'P1124';
  end if;

  if v_deposit.status not in ('succeeded', 'partially_refunded') then
    raise exception 'Cannot apply a deposit payment that is %.', v_deposit.status using errcode = 'P1124';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  if v_deposit.workspace_id <> v_invoice.workspace_id or v_deposit.client_id <> v_invoice.client_id then
    raise exception 'The deposit and the target invoice must belong to the same workspace and client.' using errcode = 'P1125';
  end if;

  if v_deposit.currency <> v_invoice.currency then
    raise exception 'The deposit currency does not match the invoice currency.' using errcode = 'P1126';
  end if;

  if v_invoice.status not in ('issued', 'sent', 'viewed', 'partially_paid', 'overdue') then
    raise exception 'Cannot apply a deposit to an invoice that is %.', v_invoice.status using errcode = 'P1127';
  end if;

  select coalesce(sum(amount_minor), 0) into v_prior_refunds
  from public.payments
  where reference = 'refund_of:' || v_deposit.id::text
    and status in ('succeeded', 'partially_refunded', 'refunded');

  select coalesce(sum(amount_minor), 0) into v_prior_applications
  from public.payments
  where reference = 'deposit_application_of:' || v_deposit.id::text
    and status in ('succeeded', 'partially_refunded', 'refunded');

  v_available := greatest(0, v_deposit.amount_minor - v_prior_refunds - v_prior_applications);

  if p_amount_minor > v_available then
    raise exception 'Cannot apply more than the available deposit balance (% minor units remaining).', v_available
      using errcode = 'P1122';
  end if;

  if p_amount_minor > v_invoice.balance_minor then
    raise exception 'Cannot apply more than the invoice''s outstanding balance (% minor units remaining).', v_invoice.balance_minor
      using errcode = 'P1123';
  end if;

  insert into public.payments (
    id, workspace_id, invoice_id, client_id, event_id, contract_id,
    payment_type, status, amount_minor, currency, payment_method,
    reference, transaction_date, received_at, notes
  ) values (
    p_application_payment_id, v_deposit.workspace_id, p_invoice_id, v_deposit.client_id, v_deposit.event_id, v_deposit.contract_id,
    'adjustment', 'succeeded', p_amount_minor, v_deposit.currency, 'other',
    v_reference, (now() at time zone 'utc')::date, now(),
    'Customer Deposit ' || v_deposit.id::text || ' applied to invoice.'
  )
  returning * into v_application;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (v_application.workspace_id, 'payment', v_application.id, 'deposit_applied', 'Customer Deposit applied to invoice', p_actor);

  perform public.post_deposit_application(v_application.id, v_deposit.id, p_actor);

  perform public.recompute_invoice_balance(p_invoice_id, p_actor);

  return v_application;
end;
$$;

comment on function public.record_deposit_application(uuid, uuid, integer, uuid, text) is
  'Atomic Customer Deposit -> Invoice application: locks the deposit Payment row then the target Invoice row (in that order), validates the deposit is an unapplied Customer Deposit in a consumable status, workspace/client/currency consistency, and invoice application-eligible status, computes the available-deposit ceiling (deposit amount minus prior completed refunds AND prior completed applications of it), rejects over-application against both that ceiling (P1122) and the invoice''s own outstanding balance (P1123), inserts the application Payment row using the caller-supplied p_application_payment_id (payment_type=''adjustment'', payment_method=''other'', status=''succeeded'', reference=''deposit_application_of:<deposit_id>''), composes post_deposit_application, recomputes the invoice balance, and returns the application Payment -- all in one transaction. No state can exist where the Payment row exists but posting failed, or posting exists but the invoice balance was not recomputed. Finance F2.1C-C-IDEMPOTENCY: p_application_payment_id is a REQUIRED (P1130 if null) request-level idempotency key -- a repeat call with the same key and the same deposit/invoice/amount payload replays the original result (no re-mutation); a repeat with a different payload is rejected (P1129). Does not implement application reversal -- see this migration''s header comment.';

-- Phase 10: the refund ceiling must also subtract prior deposit
-- applications of the SAME payment, or a deposit could be refunded AND
-- applied for more than it ever held. Every other line of process_
-- payment_refund is byte-for-byte unchanged from the F2.1C-B-REVIEW
-- version -- only v_refundable's formula gains a third term.
create or replace function public.process_payment_refund(
  p_original_payment_id uuid,
  p_amount_minor integer,
  p_refund_payment_id uuid,
  p_actor text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_original public.payments;
  v_existing public.payments;
  v_reference text;
  v_prior_refunds integer;
  v_prior_applications integer;
  v_refundable integer;
  v_refund public.payments;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a refund amount greater than zero.' using errcode = 'P0001';
  end if;

  -- Finance F2.1C-C-IDEMPOTENCY: p_refund_payment_id is now the REQUEST-
  -- level idempotency identity, not merely an internally-generated row id
  -- -- required (no default), same convention record_deposit_application
  -- reuses from record_purchase_receipt / p_receipt_event_id. The caller
  -- must supply the SAME value on every retry of the same logical
  -- "refund this amount of this payment" request.
  if p_refund_payment_id is null then
    raise exception 'p_refund_payment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same refund request).'
      using errcode = 'P1130';
  end if;

  select * into v_original from public.payments where id = p_original_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  v_reference := 'refund_of:' || v_original.id::text;

  -- Request-level idempotency: a repeat of the SAME p_refund_payment_id is
  -- a REPLAY of an already-completed request, not a new mutation -- return
  -- the existing refund Payment unchanged, without re-running the status/
  -- ceiling checks below (which could spuriously fail against CURRENT
  -- state that has moved on since the original, already-successful call --
  -- e.g. v_original.status is expected to have changed to refunded/
  -- partially_refunded AS A RESULT of that original call). A payload
  -- mismatch (same key, different original payment or amount) is a
  -- genuine conflict, not a valid replay. The v_original row lock above
  -- already serializes concurrent retries of the SAME logical request
  -- (same p_original_payment_id), so no additional lock is needed here --
  -- same reasoning as post_purchase_receipt's own concurrency note. The
  -- payments.id primary key constraint is the final, unconditional
  -- database-level backstop for the residual (adversarial-caller-only)
  -- case of the same key reused across genuinely different original
  -- payments, which cannot share this lock.
  select * into v_existing from public.payments where id = p_refund_payment_id;
  if found then
    if v_existing.reference is distinct from v_reference or v_existing.amount_minor <> p_amount_minor then
      raise exception 'This idempotency key was already used for a different refund request.' using errcode = 'P1129';
    end if;
    return v_existing;
  end if;

  if v_original.status not in ('succeeded', 'partially_refunded') then
    raise exception 'Cannot refund a payment that is %.', v_original.status using errcode = 'P0003';
  end if;

  select coalesce(sum(amount_minor), 0) into v_prior_refunds
  from public.payments
  where reference = v_reference
    and status in ('succeeded', 'partially_refunded', 'refunded');

  select coalesce(sum(amount_minor), 0) into v_prior_applications
  from public.payments
  where reference = 'deposit_application_of:' || v_original.id::text
    and status in ('succeeded', 'partially_refunded', 'refunded');

  v_refundable := greatest(0, v_original.amount_minor - v_prior_refunds - v_prior_applications);

  if p_amount_minor > v_refundable then
    raise exception 'Cannot refund more than the refundable amount (% minor units remaining).', v_refundable
      using errcode = 'P0004';
  end if;

  insert into public.payments (
    id, workspace_id, invoice_id, client_id, event_id, contract_id,
    payment_type, status, amount_minor, currency, payment_method,
    reference, transaction_date, received_at, refunded_at, notes
  ) values (
    p_refund_payment_id, v_original.workspace_id, v_original.invoice_id, v_original.client_id, v_original.event_id, v_original.contract_id,
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

comment on function public.process_payment_refund(uuid, integer, uuid, text) is
  'Atomic, row-locked equivalent of the mock''s refundPayment() -- validates the refundable ceiling against prior refunds AND prior deposit applications (Finance F2.1C-C), inserts the refund Payment using the caller-supplied p_refund_payment_id, updates the original''s status, logs Timeline, and posts the settlement (+ Revenue correction where applicable) reversal via post_payment_refund_reversal -- all in one transaction. Fails safely (P1118) rather than inventing a reversal for a payment with no settlement entry, unchanged from F1.8. Finance F2.1C-C-IDEMPOTENCY: p_refund_payment_id is a REQUIRED (P1130 if null) request-level idempotency key -- a repeat call with the same key and the same (original payment, amount) payload replays the original result (no re-mutation); a repeat with a different payload is rejected (P1129).';
