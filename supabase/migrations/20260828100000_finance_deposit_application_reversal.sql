-- Finance F2.1C-E-B: Deposit Application Reversal.
--
-- Implements the architecture finalized in F2.1C-E-A: reverses ONE exact,
-- already-posted Deposit Application in full (FULL_ONLY — never partial,
-- the reversal amount is always the target Application's own amount_minor,
-- never caller-supplied). Restores the Customer Deposit liability and the
-- Invoice's AR position — the exact inverse of post_deposit_application's
-- own posting:
--
--   Original Application:  Dr 2200 Customer Deposits / Cr 1100 AR
--   Reversal:               Dr 1100 AR / Cr 2200 Customer Deposits
--
-- No Cash (1000), Revenue (4000), Refunds & Returns (4950), Sales Tax
-- Payable (2100), or Sales Discounts (4900) line — this is a pure
-- balance-sheet reallocation, never a P&L or Cash event. The original
-- Application Payment/Journal Entry is never mutated (append-only).
--
-- REVERSAL REPRESENTATION: a NEW Payment row, mirroring how refunds get
-- their own Payment row (the second of the two candidate models the
-- original F2.1C-C migration's own header comment named and deferred) —
--   payment_type   = 'refund'   -- reused ONLY because recompute_invoice_
--                                  balance's v_gross_paid/v_refunded split
--                                  is the ONLY existing mechanism that
--                                  subtracts a linked payment from
--                                  paid_minor; this is an internal
--                                  representational choice, never a claim
--                                  that Cash moved. Reference/Timeline keep
--                                  the audit trail unambiguous.
--   payment_method = 'other'    -- never impersonates a real refund method.
--   reference      = 'deposit_application_reversal_of:<application_id>'
--                                  -- points at the specific Application
--                                  reversed, never at the deposit directly.
--
-- Posting identity: source_type='deposit_application_reversal' (NEW —
-- widens journal_entries_source_type_check, same drop/add pattern every
-- prior widening in this schema uses), source_id=<reversal_id>,
-- posting_key='deposit_application_reversal:<reversal_id>'.
--
-- MANDATORY LOCK ORDER (Finance F2.1C-E-A): Application row -> Deposit row
-- -> Invoice row. The Deposit-row lock is NOT optional: record_deposit_
-- application's own v_available computation locks that SAME row before
-- reading its derived-sum ceiling — locking it here too is what serializes
-- a reversal against a concurrent NEW Application of the same deposit and
-- is the only thing that prevents a restored amount from being
-- double-spent. No new lock-order cycle is introduced: no other Finance
-- RPC locks a payment row after locking an invoice row.
--
-- MANDATORY AVAILABILITY FIX: a correctly-posted reversal Journal Entry
-- alone does not restore product-level deposit availability — record_
-- deposit_application's own v_available and process_payment_refund's own
-- v_refundable both compute "prior applications" by matching payments
-- whose reference points at the deposit directly
-- ('deposit_application_of:<deposit_id>'); a reversal's reference points
-- at the APPLICATION it reverses instead
-- ('deposit_application_reversal_of:<application_id>'), so neither ceiling
-- would ever see it without this fix. Both are redefined below to net
-- prior applications against any completed reversal of each individual
-- Application (never a global sum against the deposit) — see each
-- function's own comment for the exact two-hop lookup.
--
-- FULL_ONLY double-reversal protection: a binary check (0 vs 1 active
-- reversal for a given Application) — there is no "partial remaining"
-- ceiling to compute, since the reversal amount is always the
-- Application's full amount. Re-checked under the Application row lock, so
-- a concurrent second reversal attempt for the SAME Application correctly
-- serializes.
--
-- REQUEST IDEMPOTENCY (mirrors every prior Finance idempotency-key
-- convention exactly): p_reversal_id is REQUIRED (P1130), checked BEFORE
-- any other validation. The durable replay target is the Application's own
-- id alone, encoded in the reversal Payment's own `reference` field — no
-- numeric payload is needed, since FULL_ONLY makes the reversal amount
-- fully deterministic from the target (a simpler, more robust replay story
-- than Invoice Adjustment's own 3-field durable memo).
--
-- INVOICE ELIGIBILITY: issued/sent/viewed/partially_paid/paid/overdue —
-- the SAME set Invoice Adjustment already uses (reversal, unlike
-- Application itself, doesn't require an outstanding balance). draft is
-- vacuously excluded (an Application can never exist on a draft invoice —
-- Application's own eligible-status set already excludes it). voided/
-- archived are rejected (P1141) — the same terminal-freeze principle just
-- established for refund (P1139): a terminal Invoice's economics must stay
-- permanently frozen. A voided Invoice can never legitimately hold an
-- unresolved Application under the current engine (P1137 blocks Partial
-- Void's Case B while one exists, and Case A is unreachable while
-- paid_minor>0) — this guard protects only pre-existing/historical data,
-- not a reachable live path.
--
-- VOID BLOCKER AWARENESS (discovered while implementing this checkpoint's
-- own local verification, NOT part of the F2.1C-E-A architecture — a
-- genuine gap found by actually exercising the reversal-then-void
-- interaction Phase 11 of that architecture called "SAFE"): void_invoice_
-- and_reverse_revenue_recognition's own P1137 blocker query has no
-- awareness of this checkpoint's reversal mechanism — it flags ANY payment
-- row shaped like a Deposit Application as "unresolved" regardless of
-- whether it has since been reversed, since the original F2.1C-D-D-B
-- migration predates reversal's existence entirely. Without this fix, a
-- legitimately reversed Application would still permanently block Void —
-- defeating the primary reason this whole checkpoint exists. Redefined
-- below with the SAME (uuid, uuid, text, text) signature and otherwise
-- byte-for-byte unchanged logic, narrowing the blocker query to exclude an
-- Application that already has a completed reversal targeting its own id
-- (the P1137 error message text is also updated — it previously said
-- reversal was "not yet available", which is no longer true).
--
-- PAID-STATUS VOID-ELIGIBILITY FIX (discovered during F2.1C-E-B-REVIEW: a
-- genuine, narrower gap in the SAME already-redefined function, found by
-- proving the F2.1C-E-A architecture's REVERSAL_THEN_CLEAN_VOID=SAFE claim
-- against every reachable Application-history case, not just the ones its
-- own worked examples covered). When a Deposit Application was an
-- invoice's SOLE settlement, reversing it correctly drives paid_minor to
-- 0, but recompute_invoice_balance's status ladder never reverts status
-- away from 'paid' once reached (paid_minor=0 matches neither of its own
-- paid/partially_paid branches — a PRE-EXISTING characteristic, equally
-- reachable via a 100% Cash refund of a fully-paid invoice, not introduced
-- by this checkpoint). Without a fix, such an invoice would be
-- economically unpaid (paid_minor=0, balance=total) yet permanently
-- ineligible for Void, since 'paid' is not in the status-eligibility list
-- below and the generic invoice_transitions table (paid -> [archived]
-- only) intentionally never allows paid -> voided for a GENUINELY paid
-- invoice. Fixed with a narrow, LOCAL exception inside this function's own
-- status-eligibility check ONLY — status='paid' AND paid_minor=0 is now
-- additionally accepted, routing into the SAME Case A branch immediately
-- below (already driven by paid_minor, not status), which correctly
-- overwrites the stale 'paid' label with 'voided'. This does NOT modify
-- core/workflows/invoiceWorkflow.ts's shared INVOICE_TRANSITIONS/
-- canTransitionInvoiceStatus table or its own UI consumer (InvoiceActions.
-- tsx's canVoid) — a genuinely paid invoice remains correctly non-void-
-- eligible everywhere else in the product. The current UI has no button
-- that reaches this specific exception yet (canVoid still reads the
-- unmodified shared table) — that is expected and correct for an
-- engine-only checkpoint; exposing it is future UI-checkpoint work, not
-- this one. The broader, PRE-EXISTING characteristic of a stale 'paid'
-- status label persisting in reports/UI until the invoice is voided or
-- otherwise corrected (identical for a 100%-refunded invoice) remains
-- unfixed and out of this checkpoint's scope — a shared, cross-domain
-- concern for a future, dedicated status-ladder checkpoint, not specific
-- to Deposit Application Reversal.
--
-- Scope boundary: this migration does NOT implement historical backfill,
-- reconciliation activation, RLS/policy redesign, Chart of Accounts
-- changes, or any UI. It does not modify record_invoice_adjustment. It
-- does not edit any already-pushed historical migration file —
-- record_deposit_application, process_payment_refund, and void_invoice_
-- and_reverse_revenue_recognition are redefined here, in a NEW migration,
-- per this whole project's "never edit an already-pushed migration"
-- discipline (the same technique 20260827100000 used for post_payment_
-- refund_reversal and record_invoice_adjustment).

alter table public.journal_entries drop constraint journal_entries_source_type_check;
alter table public.journal_entries
  add constraint journal_entries_source_type_check check (
    source_type in (
      'purchase_receipt', 'invoice_issued', 'invoice_voided', 'payment_settlement', 'payment_refund',
      'expense_due', 'expense_paid', 'expense_reimbursed', 'expense_due_reversal',
      'inventory_adjustment', 'inventory_writeoff', 'inventory_event_checkout', 'inventory_event_return',
      'inventory_initial_stock', 'vendor_payment', 'vendor_refund', 'stripe_payout', 'manual_adjustment',
      'reversal', 'deposit_application', 'invoice_adjustment', 'invoice_partial_void', 'deposit_application_reversal'
    )
  );

-- ---------------------------------------------------------------------------
-- post_deposit_application_reversal — posts the fixed 2-line entry for an
-- ALREADY-VALIDATED, already-inserted reversal Payment row. Does not
-- re-validate anything itself — mirrors post_deposit_application/post_
-- payment_refund_reversal trusting their owning RPC's prior validation.
-- ---------------------------------------------------------------------------

create or replace function public.post_deposit_application_reversal(
  p_reversal_id uuid,
  p_application_payment_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_reversal public.payments;
  v_posting_key text;
  v_entry public.journal_entries;
begin
  select * into v_reversal from public.payments where id = p_reversal_id;
  if not found then
    raise exception 'Deposit application reversal payment not found.' using errcode = 'P1111';
  end if;

  if exists (
    select 1 from public.journal_entries
    where source_type = 'deposit_application_reversal' and source_id = p_reversal_id::text
  ) then
    raise exception 'This deposit application reversal has already been posted.' using errcode = 'P1104';
  end if;

  v_posting_key := 'deposit_application_reversal:' || p_reversal_id;

  v_entry := public.finance_insert_journal_entry(
    v_reversal.workspace_id,
    v_reversal.transaction_date,
    'deposit_application_reversal',
    p_reversal_id::text,
    'Deposit Application reversal: application_id=' || p_application_payment_id::text,
    p_actor,
    null,
    v_posting_key,
    jsonb_build_array(
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_reversal.workspace_id, 1100)).id,
        'debit_minor', v_reversal.amount_minor, 'credit_minor', 0
      ),
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_reversal.workspace_id, 2200)).id,
        'debit_minor', 0, 'credit_minor', v_reversal.amount_minor
      )
    )
  );

  return v_entry;
end;
$$;

comment on function public.post_deposit_application_reversal(uuid, uuid, text) is
  'Posts Dr 1100 Accounts Receivable / Cr 2200 Customer Deposits for one deposit-application-reversal event, for an ALREADY-VALIDATED, already-inserted reversal Payment row — the exact inverse of post_deposit_application. No Cash line, no Revenue-affecting account touched. Idempotent per reversal row via posting_key ''deposit_application_reversal:<reversal_id>'', errcode P1104 on retry.';

-- ---------------------------------------------------------------------------
-- record_deposit_application_reversal — the atomic owning RPC.
-- ---------------------------------------------------------------------------

create or replace function public.record_deposit_application_reversal(
  p_application_payment_id uuid,
  p_reversal_id uuid,
  p_reason text,
  p_actor text
)
returns public.payments
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_application public.payments;
  v_deposit_id uuid;
  v_deposit public.payments;
  v_invoice public.invoices;
  v_existing_reversal public.payments;
  v_reversal_reference text;
  v_already_reversed boolean;
  v_application_entry public.journal_entries;
  v_reversal public.payments;
begin
  if p_reversal_id is null then
    raise exception 'p_reversal_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same reversal request).'
      using errcode = 'P1130';
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reversal reason is required.' using errcode = 'P1112';
  end if;

  -- Lock order: Application row -> Deposit row -> Invoice row (Finance
  -- F2.1C-E-A's finalized, mandatory architecture — see this migration's
  -- header comment for the double-spend rationale).
  select * into v_application from public.payments where id = p_application_payment_id for update;
  if not found then
    raise exception 'Deposit application payment not found.' using errcode = 'P1111';
  end if;

  v_reversal_reference := 'deposit_application_reversal_of:' || p_application_payment_id;

  -- Request-level idempotency: checked immediately after locating the
  -- target, before any other validation (which could spuriously fail
  -- against CURRENT state on a replay) — same convention as every other
  -- Finance idempotency-key check in this file set. The durable replay
  -- target is the Application's own id alone (encoded in this reference),
  -- no numeric payload needed since FULL_ONLY makes the amount
  -- deterministic from the target.
  select * into v_existing_reversal from public.payments where id = p_reversal_id;
  if found then
    if v_existing_reversal.reference is distinct from v_reversal_reference then
      raise exception 'This idempotency key was already used for a different deposit application reversal request.' using errcode = 'P1129';
    end if;
    return v_existing_reversal;
  end if;

  -- Finance F2.1C-E-B: defensive/structural guard (P1142) — the source
  -- must actually BE a posted Deposit Application (an 'adjustment'-typed,
  -- invoice-linked payment whose reference points back at an original
  -- deposit). Should be unreachable given callers only ever pass a real
  -- Application's own id, but never invents a reversal for something that
  -- was never really applied.
  if v_application.payment_type != 'adjustment' or v_application.invoice_id is null or v_application.reference is null
    or v_application.reference not like 'deposit_application_of:%'
  then
    raise exception 'This payment is not a Deposit Application and cannot be reversed.' using errcode = 'P1142';
  end if;

  -- FULL_ONLY double-reversal protection: a binary check, since the
  -- reversal amount is always the Application's full amount — there is no
  -- "partial remaining" ceiling to compute. Re-checked under the
  -- Application row lock above, so a concurrent second reversal attempt
  -- for the SAME Application correctly serializes.
  select exists (
    select 1 from public.payments
    where reference = v_reversal_reference
      and status in ('succeeded', 'partially_refunded', 'refunded')
  ) into v_already_reversed;
  if v_already_reversed then
    raise exception 'This Deposit Application has already been reversed.' using errcode = 'P1140';
  end if;

  -- Extract the original deposit's id from the Application's own
  -- reference (format 'deposit_application_of:<deposit_id>' — nothing
  -- follows the id in this reference shape, so a plain to-end-of-string
  -- capture is delimiter-safe here, unlike Partial Void's own memo parser
  -- which had to guard against trailing punctuation).
  v_deposit_id := substring(v_application.reference from 'deposit_application_of:(.*)')::uuid;

  -- Lock the ORIGINAL Customer Deposit Payment row — MANDATORY, not
  -- optional (see this migration's header comment for the full
  -- double-spend rationale: record_deposit_application's own v_available
  -- computation locks this SAME row).
  select * into v_deposit from public.payments where id = v_deposit_id for update;
  if not found then
    raise exception 'Deposit payment not found.' using errcode = 'P1111';
  end if;

  select * into v_invoice from public.invoices where id = v_application.invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  if v_invoice.status not in ('issued', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue') then
    raise exception 'Cannot reverse a Deposit Application on an invoice that is %.', v_invoice.status using errcode = 'P1141';
  end if;

  -- Mirrors post_deposit_application's own P1118-equivalent guard: proves
  -- the Application was actually posted, not merely shaped like one.
  select * into v_application_entry
  from public.journal_entries
  where workspace_id = v_application.workspace_id
    and source_type = 'deposit_application'
    and source_id = v_application.id::text;
  if not found then
    raise exception 'No Deposit Application posting exists for this payment — cannot reverse.' using errcode = 'P1142';
  end if;

  insert into public.payments (
    id, workspace_id, invoice_id, client_id, event_id, contract_id,
    payment_type, status, amount_minor, currency, payment_method,
    reference, transaction_date, received_at, refunded_at, notes
  ) values (
    p_reversal_id, v_application.workspace_id, v_application.invoice_id, v_application.client_id, v_application.event_id, v_application.contract_id,
    'refund', 'succeeded', v_application.amount_minor, v_application.currency, 'other',
    v_reversal_reference, (now() at time zone 'utc')::date, now(), now(),
    'Deposit Application ' || v_application.id::text || ' reversed. ' || p_reason
  )
  returning * into v_reversal;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (
    v_reversal.workspace_id, 'payment', v_reversal.id, 'deposit_application_reversed',
    format('Customer Deposit application reversed (%s)', p_reason), p_actor
  );

  perform public.post_deposit_application_reversal(p_reversal_id, p_application_payment_id, p_actor);

  perform public.recompute_invoice_balance(v_application.invoice_id, p_actor);

  return v_reversal;
end;
$$;

comment on function public.record_deposit_application_reversal(uuid, uuid, text, text) is
  'Finance F2.1C-E-B: reverses ONE exact, already-posted Deposit Application in full (FULL_ONLY — the reversal amount is always the target Application''s own amount_minor, never caller-supplied). Locks Application row, then the original Deposit Payment row (mandatory — this is what serializes against a concurrent new Application of the same deposit and prevents double-spend of the restored amount), then the Invoice row, in that order. Validates the source is a real posted Deposit Application (P1142, defensive), rejects an already-reversed Application (P1140) and an Invoice in a reversal-ineligible status (P1141, draft/voided/archived). Inserts a new reversal Payment row (payment_type=''refund'' — reused only for recompute_invoice_balance compatibility, reference=''deposit_application_reversal_of:<application_id>''), composes post_deposit_application_reversal, recomputes the invoice balance, writes a deposit_application_reversed Timeline entry, and returns the reversal Payment — all in one transaction. Idempotent per p_reversal_id (P1130 if null, P1129 on a genuine payload conflict) via the target durably recorded in the reversal''s own reference.';

-- ---------------------------------------------------------------------------
-- record_deposit_application — redefined ONLY to net v_available against
-- any completed reversal of an individual prior Application. Every other
-- line is byte-for-byte identical to 20260824100000's version.
-- ---------------------------------------------------------------------------

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
  v_prior_application_reversals integer;
  v_available integer;
  v_application public.payments;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a deposit application amount greater than zero.' using errcode = 'P1128';
  end if;

  if p_application_payment_id is null then
    raise exception 'p_application_payment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same deposit application request).'
      using errcode = 'P1130';
  end if;

  select * into v_deposit from public.payments where id = p_deposit_payment_id for update;
  if not found then
    raise exception 'Deposit payment not found.' using errcode = 'P1111';
  end if;

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
  where reference = v_reference
    and status in ('succeeded', 'partially_refunded', 'refunded');

  -- Finance F2.1C-E-B: net prior applications against any completed
  -- reversal of an INDIVIDUAL prior Application (never a global sum
  -- against the deposit) — a reversed Application no longer consumes this
  -- deposit's availability. See this migration's header comment for why a
  -- correctly-posted reversal Journal Entry alone would not otherwise be
  -- visible to this ceiling.
  select coalesce(sum(r.amount_minor), 0) into v_prior_application_reversals
  from public.payments a
  join public.payments r
    on r.reference = 'deposit_application_reversal_of:' || a.id::text
   and r.status in ('succeeded', 'partially_refunded', 'refunded')
  where a.reference = v_reference
    and a.status in ('succeeded', 'partially_refunded', 'refunded');

  v_available := greatest(0, v_deposit.amount_minor - v_prior_refunds - v_prior_applications + v_prior_application_reversals);

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
  'Atomic Customer Deposit -> Invoice application: locks the deposit Payment row then the target Invoice row (in that order), validates the deposit is an unapplied Customer Deposit in a consumable status, workspace/client/currency consistency, and invoice application-eligible status, computes the available-deposit ceiling (deposit amount minus prior completed refunds and prior completed applications, net of any completed reversal of an individual application — Finance F2.1C-E-B), rejects over-application against both that ceiling (P1122) and the invoice''s own outstanding balance (P1123), inserts the application Payment row using the caller-supplied p_application_payment_id (payment_type=''adjustment'', payment_method=''other'', status=''succeeded'', reference=''deposit_application_of:<deposit_id>''), composes post_deposit_application, recomputes the invoice balance, and returns the application Payment — all in one transaction. Finance F2.1C-C-IDEMPOTENCY: p_application_payment_id is a REQUIRED (P1130 if null) request-level idempotency key — a repeat call with the same key and the same deposit/invoice/amount payload replays the original result (no re-mutation); a repeat with a different payload is rejected (P1129).';

-- ---------------------------------------------------------------------------
-- process_payment_refund — redefined ONLY to net v_refundable against any
-- completed reversal of an individual prior Application of this payment.
-- Every other line is byte-for-byte identical to 20260824100000's version.
-- ---------------------------------------------------------------------------

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
  v_prior_application_reversals integer;
  v_refundable integer;
  v_refund public.payments;
begin
  if p_amount_minor is null or p_amount_minor <= 0 then
    raise exception 'Enter a refund amount greater than zero.' using errcode = 'P0001';
  end if;

  if p_refund_payment_id is null then
    raise exception 'p_refund_payment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same refund request).'
      using errcode = 'P1130';
  end if;

  select * into v_original from public.payments where id = p_original_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'P0002';
  end if;

  v_reference := 'refund_of:' || v_original.id::text;

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

  -- Finance F2.1C-E-B: same net-of-reversal fix as record_deposit_
  -- application's own v_available above — a reversed Application no
  -- longer consumes this payment's own refundable ceiling either.
  select coalesce(sum(r.amount_minor), 0) into v_prior_application_reversals
  from public.payments a
  join public.payments r
    on r.reference = 'deposit_application_reversal_of:' || a.id::text
   and r.status in ('succeeded', 'partially_refunded', 'refunded')
  where a.reference = 'deposit_application_of:' || v_original.id::text
    and a.status in ('succeeded', 'partially_refunded', 'refunded');

  v_refundable := greatest(0, v_original.amount_minor - v_prior_refunds - v_prior_applications + v_prior_application_reversals);

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
  'Atomic, row-locked equivalent of the mock''s refundPayment() -- validates the refundable ceiling against prior refunds AND prior deposit applications (net of any completed reversal of an individual application — Finance F2.1C-E-B), inserts the refund Payment using the caller-supplied p_refund_payment_id, updates the original''s status, logs Timeline, and posts the settlement (+ Revenue correction where applicable) reversal via post_payment_refund_reversal -- all in one transaction. Fails safely (P1118) rather than inventing a reversal for a payment with no settlement entry, unchanged from F1.8. Finance F2.1C-C-IDEMPOTENCY: p_refund_payment_id is a REQUIRED (P1130 if null) request-level idempotency key -- a repeat call with the same key and the same (original payment, amount) payload replays the original result (no re-mutation); a repeat with a different payload is rejected (P1129).';

-- ---------------------------------------------------------------------------
-- void_invoice_and_reverse_revenue_recognition — redefined ONLY to make the
-- P1137 blocker query aware of this checkpoint's reversal mechanism. Every
-- other line is byte-for-byte identical to 20260827100000's version — see
-- this migration's own header comment for why this fix is required.
-- ---------------------------------------------------------------------------

create or replace function public.void_invoice_and_reverse_revenue_recognition(
  p_invoice_id uuid,
  p_cancellation_id uuid,
  p_reason text,
  p_actor text
)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_existing_entry public.journal_entries;
  v_replay_invoice_id text;
  v_has_unresolved_deposit boolean;
  v_cancellable integer;
  v_tax_cancelled integer;
  v_discount_cancelled integer;
  v_subtotal_cancelled integer;
  v_new_subtotal integer;
  v_new_tax integer;
  v_new_discount integer;
  v_new_total integer;
  v_lines jsonb;
  v_posting_key text;
  v_recomputed public.invoices;
begin
  if p_cancellation_id is null then
    raise exception 'p_cancellation_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same void/cancellation request).'
      using errcode = 'P1130';
  end if;

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  select * into v_existing_entry
  from public.journal_entries
  where source_type = 'invoice_partial_void' and source_id = p_cancellation_id::text;

  if found then
    v_replay_invoice_id := substring(v_existing_entry.memo from 'invoice_id=([^\s.]+)');
    if v_replay_invoice_id = p_invoice_id::text then
      return v_invoice;
    end if;
    raise exception 'This idempotency key was already used for a different void/cancellation request.' using errcode = 'P1129';
  end if;

  -- Finance F2.1C-E-B: a local, function-only exception — does NOT touch
  -- the generic invoice status-transition table (shared with the UI's own
  -- Void-button gating; a genuinely paid invoice must never become
  -- void-eligible there). Found during this checkpoint's own review:
  -- reversing a Deposit Application that was an invoice's SOLE settlement
  -- correctly drives paid_minor to 0, but recompute_invoice_balance's
  -- status ladder never reverts status away from 'paid' once reached
  -- (paid_minor=0 matches neither of its own paid/partially_paid
  -- branches) — leaving a paid_minor=0 invoice stuck at a status this
  -- function would otherwise treat as terminal-for-voiding, even though
  -- Case A immediately below is driven by paid_minor, not status, and
  -- handles it correctly. Without this exception, "unblock Void" — this
  -- whole checkpoint's stated purpose — would not be achieved for an
  -- invoice whose ONLY settlement was the reversed Application.
  if v_invoice.status not in ('draft', 'issued', 'sent', 'viewed', 'partially_paid', 'overdue')
    and not (v_invoice.status = 'paid' and v_invoice.paid_minor = 0)
  then
    raise exception 'Cannot void an invoice that is already %.', v_invoice.status using errcode = 'P1105';
  end if;

  if v_invoice.paid_minor = 0 then
    update public.invoices
    set status = 'voided', voided_at = now(), updated_at = now()
    where id = p_invoice_id
    returning * into v_invoice;

    perform public.post_invoice_voided_reversal(p_invoice_id, p_actor);

    return v_invoice;
  end if;

  if v_invoice.balance_minor = 0 then
    raise exception 'This invoice has no outstanding balance to cancel — it is fully paid. Use a refund or an invoice financial adjustment instead.'
      using errcode = 'P1136';
  end if;

  -- Case B: Partial-Payment Cancellation.
  -- Finance F2.1C-E-B: an Application only counts as unresolved when no
  -- completed reversal targets its own id — see this migration's header
  -- comment for why this fix is required.
  select exists (
    select 1 from public.payments a
    where a.invoice_id = p_invoice_id
      and a.payment_type = 'adjustment'
      and a.reference like 'deposit_application_of:%'
      and a.status in ('succeeded', 'partially_refunded', 'refunded')
      and not exists (
        select 1 from public.payments r
        where r.reference = 'deposit_application_reversal_of:' || a.id::text
          and r.status in ('succeeded', 'partially_refunded', 'refunded')
      )
  ) into v_has_unresolved_deposit;

  if v_has_unresolved_deposit then
    raise exception 'Cannot void this invoice — it has an unresolved Customer Deposit Application. Reverse the Deposit Application first.'
      using errcode = 'P1137';
  end if;

  v_cancellable := v_invoice.total_minor - v_invoice.paid_minor;
  v_tax_cancelled := round((v_cancellable::numeric * v_invoice.tax_minor) / v_invoice.total_minor);
  v_discount_cancelled := round((v_cancellable::numeric * v_invoice.discount_minor) / v_invoice.total_minor);
  v_subtotal_cancelled := v_cancellable + v_discount_cancelled - v_tax_cancelled;

  v_new_subtotal := v_invoice.subtotal_minor - v_subtotal_cancelled;
  v_new_tax := v_invoice.tax_minor - v_tax_cancelled;
  v_new_discount := v_invoice.discount_minor - v_discount_cancelled;
  v_new_total := v_invoice.total_minor - v_cancellable;

  if v_new_subtotal < 0 or v_new_tax < 0 or v_new_discount < 0 or v_new_total < 0 then
    raise exception 'Unable to compute a balanced cancellation for this invoice.' using errcode = 'P1138';
  end if;

  v_posting_key := 'invoice_partial_void:' || p_cancellation_id;
  v_lines := jsonb_build_array(jsonb_build_object(
    'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4950)).id,
    'debit_minor', v_subtotal_cancelled, 'credit_minor', 0
  ));

  if v_tax_cancelled > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 2100)).id,
      'debit_minor', v_tax_cancelled, 'credit_minor', 0
    ));
  end if;

  if v_discount_cancelled > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4900)).id,
      'debit_minor', 0, 'credit_minor', v_discount_cancelled
    ));
  end if;

  v_lines := v_lines || jsonb_build_array(jsonb_build_object(
    'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 1100)).id,
    'debit_minor', 0, 'credit_minor', v_cancellable
  ));

  perform public.finance_insert_journal_entry(
    v_invoice.workspace_id,
    current_date,
    'invoice_partial_void',
    p_cancellation_id::text,
    format(
      'Invoice partially voided: invoice_id=%s. Settled %s retained, %s cancelled. Reason: %s',
      p_invoice_id, v_invoice.paid_minor, v_cancellable, p_reason
    ),
    p_actor,
    null,
    v_posting_key,
    v_lines
  );

  update public.invoices
  set subtotal_minor = v_new_subtotal,
      tax_minor = v_new_tax,
      discount_minor = v_new_discount,
      total_minor = v_new_total,
      status = 'voided',
      voided_at = now(),
      updated_at = now()
  where id = p_invoice_id;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (
    v_invoice.workspace_id, 'invoice', p_invoice_id, 'invoice_partially_voided',
    format('Invoice partially voided: %s retained, %s cancelled (%s)', v_invoice.paid_minor, v_cancellable, p_reason),
    p_actor
  );

  v_recomputed := public.recompute_invoice_balance(p_invoice_id, p_actor);

  return v_recomputed;
end;
$$;

comment on function public.void_invoice_and_reverse_revenue_recognition(uuid, uuid, text, text) is
  'Finance F2.1C-D-D-B: unified void/cancellation. If paid_minor = 0, behaves exactly as before this migration (full reversal of Revenue recognition via post_invoice_voided_reversal). If a payment has settled but a balance remains, runs Partial-Payment Cancellation instead: the settled economic portion stays recognized, only the genuinely unpaid CURRENT remainder is cancelled via one balanced append-only Journal Entry (source_type ''invoice_partial_void'', Dr 4950 Refunds & Returns + Dr 2100 Sales Tax Payable (if any) + Cr 4900 Sales Discounts (if any) + Cr 1100 AR — no Cash, no Customer Deposits, no direct Revenue 4000 reversal), then marks the Invoice voided and recomputes balance/status via recompute_invoice_balance. Rejects P1136 (fully paid, nothing to cancel), P1137 (unresolved Customer Deposit Application blocks void — Finance F2.1C-E-B: an Application with a completed reversal no longer counts as unresolved), P1105 (invoice already in a non-void-eligible status — Finance F2.1C-E-B-REVIEW: status=''paid'' with paid_minor=0 is additionally accepted, a narrow local exception for an invoice whose sole settlement was a now-reversed Deposit Application; the shared invoice_transitions table itself is unchanged, a genuinely paid invoice remains non-void-eligible everywhere else), P1138 (defensive, unreachable). Idempotent per p_cancellation_id, scoped to the Partial-Payment Cancellation path only — clean void''s own existing retry behavior (a hard reject) is unchanged.';
