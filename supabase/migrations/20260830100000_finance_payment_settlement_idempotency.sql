-- Finance F2.1C-F-E-C: Payment + Settlement request idempotency.
--
-- Founder decision (F2.1C-F-E-A, Option B): a UI-only fix is not accepted as
-- sufficient — New Payment (immediately-succeeded methods) and New Payment
-- Settlement must distinguish a retry of the SAME logical request from a NEW
-- intentional payment using explicit durable request identity, exactly like
-- every other Finance mutation this schema already protects (record_deposit_
-- application, process_payment_refund, record_deposit_application_reversal,
-- record_invoice_adjustment, record_manual_adjustment).
--
-- SCOPE: record_payment_settlement is the single owning mutation both
-- createPayment's immediately-succeeded path (cash/check/other manual
-- methods — see IMMEDIATELY_SUCCEEDED_METHODS in the TypeScript repository
-- layer) and recordPaymentSettlement call — verified directly from current
-- source, not assumed: both compose into insertSettledPayment, which calls
-- this exact RPC. Fixing this one function closes the ambiguous-success
-- duplication risk for both UI entry points at once. createPayment's OTHER
-- path (a payment that starts "pending", e.g. Stripe awaiting confirmation)
-- remains a plain, non-transactional insert with no request identity of its
-- own and posts no Journal Entry at creation time — Finance F2.1C-F-E-A
-- explicitly scoped that lower-severity, deferred-risk path out of this
-- checkpoint; it is not touched here.
--
-- WHY caller-supplied payments.id (Option A from F2.1C-F-E-A), NOT a
-- separate request-id column: payments.id is already `uuid primary key
-- default gen_random_uuid()` (20260721100100_payments.sql) — an explicit
-- value in this function's own INSERT column list already overrides that
-- default with zero schema change, exactly as process_payment_refund and
-- record_deposit_application/record_deposit_application_reversal already do
-- for this same table. A Payment has no pre-existing parent row to key
-- request identity off of (unlike Reversal, which keys off the original
-- entry) — the same shape Refund and Deposit Application already share,
-- which is why their identity model, not Manual Adjustment's, is the
-- correct fit for the identity/replay-lookup half of this design.
--
-- WHY compare the full persisted payload directly (Manual Adjustment's
-- technique), NOT a reference-encoded target (Refund/Deposit Application's
-- technique): payments.reference is a Founder-editable free-text field on
-- Payment itself (paymentSchema), not a system-controlled field — encoding
-- a durable target into it the way 'refund_of:<id>' does for Refund would
-- corrupt what the Founder actually entered. A Payment also has no single
-- natural "target" to encode (it isn't reversing or applying anything
-- specific). Instead, the durable replay target is reconstructed directly
-- from the existing payments row's own already-persisted columns — the same
-- fields the RPC's own INSERT already writes, compared field-for-field with
-- IS DISTINCT FROM (correctly treating NULL = NULL as equal, unlike a plain
-- <>) — never a memo/reference-embedded fingerprint, never mutable external
-- state (e.g. the linked invoice's current balance).
--
-- posting_key remains exactly 'payment_settlement:<payment_id>' — unchanged
-- format, now finally serving its originally-documented idempotency purpose
-- now that payment_id is a stable, caller-controlled identity instead of a
-- fresh gen_random_uuid() on every attempt. post_payment_settlement itself
-- (this migration's sibling, 20260804100200) is NOT redefined — its own
-- (source_type, source_id) pre-check and row lock remain exactly as
-- committed; the replay/conflict decision now happens one level up, in
-- record_payment_settlement, before post_payment_settlement is ever
-- invoked a second time for the same payment.
--
-- CONCURRENCY: like Manual Adjustment, a Payment has no natural parent
-- domain row to lock before the replay check — it is a freestanding row
-- with nothing pre-existing to act upon. payments.id's own PRIMARY KEY
-- constraint remains the absolute backstop regardless: two concurrent
-- requests sharing the exact same p_payment_id can never both commit a
-- row, because the second INSERT would violate that primary key even in
-- the vanishingly rare case where both transactions passed the replay
-- lookup as "not found" before either committed. No exception handler is
-- added for this (matching this migration set's own established "no
-- exception handlers" convention) — the losing transaction surfaces a raw
-- Postgres primary-key-violation error rather than the friendly P1129
-- message in that one narrow race, which is a cosmetic difference only: no
-- financial duplication is possible either way, and the existing generic
-- UI thrown-exception resilience (Finance F2.1C-F-E-B: PaymentForm's own
-- try/catch, safe fallback, preserved form, safe retry) absorbs it cleanly
-- — a subsequent retry with the same id finds the now-committed row via
-- the same replay lookup and returns it.
--
-- ERROR CODES: reuses the existing, already-registered P1129 (idempotency
-- key reused for a different payload) / P1130 (required key missing) pair
-- verbatim -- both are already members of the single shared
-- FINANCE_VALIDATION_ERROR_CODES set the TypeScript repository layer uses,
-- so no error-registry change is needed anywhere.
--
-- Scope boundary: does not touch RLS, policies, table columns, or any
-- constraint. Does not widen any CHECK constraint. Does not redefine
-- post_payment_settlement, recompute_invoice_balance, or any other
-- function. Does not edit any already-pushed migration -- this file only
-- redefines record_payment_settlement via create or replace, per this
-- whole project's "never edit an already-pushed migration" discipline.

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
  p_actor text,
  p_payment_id uuid
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_payment public.payments;
  v_existing public.payments;
begin
  if p_payment_id is null then
    raise exception 'p_payment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same payment request).'
      using errcode = 'P1130';
  end if;

  -- Request-level idempotency: checked immediately after the null-id
  -- guard, before any other validation (which could spuriously fail
  -- against CURRENT state on a replay) — same convention as every other
  -- Finance idempotency-key check in this migration set. Scoped to the
  -- calling workspace so a replay can never read or return a payment
  -- belonging to a different workspace.
  select * into v_existing from public.payments where id = p_payment_id and workspace_id = p_workspace_id;

  if found then
    if v_existing.invoice_id is distinct from p_invoice_id
      or v_existing.client_id is distinct from p_client_id
      or v_existing.event_id is distinct from p_event_id
      or v_existing.contract_id is distinct from p_contract_id
      or v_existing.payment_type is distinct from p_payment_type
      or v_existing.amount_minor is distinct from p_amount_minor
      or v_existing.currency is distinct from p_currency
      or v_existing.payment_method is distinct from p_payment_method
      or v_existing.reference is distinct from p_reference
      or v_existing.transaction_date is distinct from p_transaction_date
      or v_existing.notes is distinct from p_notes
    then
      raise exception 'This idempotency key was already used for a different payment request.' using errcode = 'P1129';
    end if;
    return v_existing;
  end if;

  if p_payment_method = 'stripe' then
    raise exception 'Stripe payments are not supported in this phase — record only manual/internal payment methods.'
      using errcode = 'P1117';
  end if;

  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a payment amount greater than zero.' using errcode = 'P1111';
  end if;

  insert into public.payments (
    id, workspace_id, invoice_id, client_id, event_id, contract_id,
    payment_type, status, amount_minor, currency, payment_method,
    reference, transaction_date, received_at, notes
  ) values (
    p_payment_id, p_workspace_id, p_invoice_id, p_client_id, p_event_id, p_contract_id,
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

comment on function public.record_payment_settlement(uuid, uuid, uuid, uuid, uuid, text, integer, text, text, text, date, text, text, uuid) is
  'The owning payment mutation post_payment_settlement composes into: inserts a succeeded Payment row using the caller-supplied p_payment_id directly as its primary key, recomputes the linked Invoice''s balance (if any) via the existing recompute_invoice_balance(), and posts the settlement — all in one transaction. Rejects payment_method = ''stripe'' (Stripe is deferred to its own phase). Finance F2.1C-F-E-C: p_payment_id is a REQUIRED (P1130 if null) request-level idempotency key carried directly as the Payment''s own id (posting_key = payment_settlement:<payment_id>, unchanged format) — a repeat call with the same key and the same invoice_id/client_id/event_id/contract_id/payment_type/amount_minor/currency/payment_method/reference/transaction_date/notes payload (compared against the existing row''s own persisted columns, never mutable external state) replays the original Payment with no re-mutation; a repeat with a different payload is rejected (P1129). A different key with an identical payload always creates a new, independent, legitimate Payment.';
