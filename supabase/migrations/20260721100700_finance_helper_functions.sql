-- Finance migration 8 of 8: helper functions for invoice numbering, atomic
-- payment application, and atomic refund safety.
--
-- All three are `security invoker` (not `security definer`) — same
-- rationale as convert_lead_to_client/apply_default_event_checklist/
-- generate_contract_number: every read/write inside is still governed by
-- the caller's own RLS policies, no service_role needed.

-- ---------------------------------------------------------------------------
-- generate_invoice_number — database-safe replacement for the mock's
-- generateInvoiceNumber(): same algorithm (current UTC year, workspace-
-- scoped sequence, INV-{year}-{4-digit} format, loop past any collision).
-- Only *proposes* a candidate — the durable guarantee against duplicates is
-- the workspace-scoped unique index (invoices_workspace_number_unique,
-- migration 6); the Supabase repository retries generation+insert on a
-- 23505 unique-violation, same pattern as Contracts' generate_contract_number.
-- ---------------------------------------------------------------------------

create or replace function public.generate_invoice_number(p_workspace_id uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'utc', 'YYYY');
  v_sequence integer;
  v_candidate text;
begin
  select count(*) + 1 into v_sequence
  from public.invoices
  where workspace_id = p_workspace_id;

  v_candidate := 'INV-' || v_year || '-' || lpad(v_sequence::text, 4, '0');

  while exists (
    select 1 from public.invoices
    where workspace_id = p_workspace_id and invoice_number = v_candidate
  ) loop
    v_sequence := v_sequence + 1;
    v_candidate := 'INV-' || v_year || '-' || lpad(v_sequence::text, 4, '0');
  end loop;

  return v_candidate;
end;
$$;

comment on function public.generate_invoice_number(uuid) is
  'Proposes the next workspace-scoped INV-{year}-{seq} invoice number. The unique index invoices_workspace_number_unique (migration 6) is the actual collision guarantee; callers retry on a 23505 unique-violation.';

-- ---------------------------------------------------------------------------
-- recompute_invoice_balance — the atomic equivalent of the mock's internal
-- applyPaymentToInvoice(): fully recomputes (never increments) an Invoice's
-- paid_minor/balance_minor/status from every currently-linked Payment that
-- counts toward paid, net of refunds. `select ... for update` locks the
-- Invoice row for the duration of the transaction, so concurrent calls
-- against the same Invoice (e.g. two Payments succeeding at once) serialize
-- rather than racing — recompute-from-scratch is inherently idempotent, so
-- calling this any number of times with the same underlying Payment data
-- always converges on the same, correct result. Called by the Supabase
-- repository after createPayment/markPaymentSucceeded/process_payment_refund
-- whenever a Payment linked to an Invoice changes.
--
-- Only recomputes status while the Invoice is in a payment-aware state
-- (sent/viewed/partially_paid/paid/overdue) — a draft/issued/voided/archived
-- Invoice's status is left alone, exactly mirroring the mock. Records the
-- same invoice_paid/invoice_partially_paid Timeline entry the mock records,
-- only when status actually changes, inside the same transaction — an
-- Invoice's balance and its Timeline entry can never observably diverge.
-- ---------------------------------------------------------------------------

create or replace function public.recompute_invoice_balance(p_invoice_id uuid, p_actor text)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_previous_status text;
  v_gross_paid integer;
  v_refunded integer;
  v_paid_minor integer;
  v_balance_minor integer;
  v_status text;
  v_paid_at timestamptz;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    return null;
  end if;
  v_previous_status := v_invoice.status;

  select coalesce(sum(amount_minor), 0) into v_gross_paid
  from public.payments
  where invoice_id = p_invoice_id
    and status in ('succeeded', 'partially_refunded', 'refunded')
    and payment_type != 'refund';

  select coalesce(sum(amount_minor), 0) into v_refunded
  from public.payments
  where invoice_id = p_invoice_id
    and status in ('succeeded', 'partially_refunded', 'refunded')
    and payment_type = 'refund';

  v_paid_minor := greatest(0, v_gross_paid - v_refunded);
  v_balance_minor := greatest(0, v_invoice.total_minor - v_paid_minor);

  v_status := v_invoice.status;
  v_paid_at := v_invoice.paid_at;
  if v_invoice.status in ('sent', 'viewed', 'partially_paid', 'paid', 'overdue') then
    if v_paid_minor > 0 and v_balance_minor = 0 then
      v_status := 'paid';
      v_paid_at := coalesce(v_paid_at, now());
    elsif v_paid_minor > 0 then
      v_status := 'partially_paid';
    end if;
  end if;

  update public.invoices
  set paid_minor = v_paid_minor,
      balance_minor = v_balance_minor,
      status = v_status,
      paid_at = v_paid_at,
      updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  if v_status != v_previous_status then
    if v_status = 'paid' then
      insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
      values (v_invoice.workspace_id, 'invoice', p_invoice_id, 'invoice_paid',
              'Invoice paid in full: "' || v_invoice.title || '"', p_actor);
    elsif v_status = 'partially_paid' then
      insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
      values (v_invoice.workspace_id, 'invoice', p_invoice_id, 'invoice_partially_paid',
              'Invoice partially paid: "' || v_invoice.title || '"', p_actor);
    end if;
  end if;

  return v_invoice;
end;
$$;

comment on function public.recompute_invoice_balance(uuid, text) is
  'Atomic, idempotent, row-locked equivalent of the mock''s applyPaymentToInvoice() — recomputes paid_minor/balance_minor/status from every linked Payment and logs the resulting invoice_paid/invoice_partially_paid Timeline entry in the same transaction.';

-- ---------------------------------------------------------------------------
-- process_payment_refund — the atomic equivalent of the mock's
-- refundPayment(): locks the original Payment row, recomputes the
-- refundable ceiling (original.amount_minor minus every prior refund
-- already issued against it, tracked via the reference = 'refund_of:{id}'
-- convention, migration 2), rejects an excess/invalid refund, inserts the
-- new refund Payment row, updates the original's status to
-- partially_refunded/refunded, and logs the payment_refunded Timeline
-- entry — all inside one transaction, so two concurrent refund requests
-- against the same Payment can never both succeed past the true refundable
-- ceiling (the row lock serializes them). Does NOT itself call
-- recompute_invoice_balance — the Supabase repository does that as a
-- separate, equally safe call afterward (recompute is idempotent and
-- always reflects true current Payment state, so splitting the two calls
-- introduces no correctness risk), exactly mirroring the mock's
-- refundPayment() calling applyPaymentToInvoice() as its own final step.
-- ---------------------------------------------------------------------------

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

  return v_refund;
end;
$$;

comment on function public.process_payment_refund(uuid, integer, text) is
  'Atomic, row-locked equivalent of the mock''s refundPayment() — validates the refundable ceiling against prior refunds tracked via the reference convention, inserts the refund Payment, updates the original''s status, and logs Timeline, all in one transaction. Caller still calls recompute_invoice_balance() separately afterward if the original was invoice-linked.';
