-- Finance F2.1C-D-C: Invoice Financial Adjustment.
--
-- A safe, narrow post-issuance correction operation for an already-issued
-- Invoice's economic terms (subtotal/tax/discount). Founder decision D5
-- (F2.1C-D-A/F2.1C-D-B) made this possible: F2.1C-D-B fixed the refund/
-- Invoice-field consistency bug, so this migration can safely assume
-- invoices.subtotal_minor/tax_minor/discount_minor/total_minor are always
-- the Invoice's true CURRENT economic state (already reflecting every
-- prior refund correction), never a stale original value.
--
-- APPROVED MODEL (per F2.1C-D-A's own architecture design, reconfirmed
-- here): Invoice identity remains permanent -- no rewritten/deleted
-- historical Journal Entries, no new Credit Note / Debit Note table, no
-- replacement Invoice. The correction IS a new, append-only Journal Entry
-- (source_type 'invoice_adjustment') carrying a signed delta against the
-- same accounts Revenue Recognition (invoice_issued) and Refund Revenue
-- Correction (payment_refund) already use -- plus a synchronized update to
-- the Invoice's own current economic fields, exactly mirroring how
-- F2.1C-D-B already keeps those fields in sync with refund corrections.
--
-- DELTA FORMULA (server-derived, caller never supplies a total or touches
-- currency -- Founder decision D3 keeps currency permanently immutable
-- post-issuance, already enforced by updateInvoice's own guard and simply
-- never accepted as an adjustment input at all):
--   new_total    = new_subtotal + new_tax - new_discount
--   delta_subtotal = new_subtotal - old_subtotal
--   delta_tax      = new_tax - old_tax
--   delta_discount = new_discount - old_discount
--   delta_total    = new_total - old_total  (always exactly equals
--                    delta_subtotal + delta_tax - delta_discount, by
--                    construction of new_total/old_total -- verified below)
--
-- ACCOUNTING SEMANTICS (each line posted only when its own delta is
-- nonzero -- a component can change even when delta_total = 0, e.g. a
-- discount increase offsetting a subtotal increase, and still posts a
-- balanced entry with no AR line at all):
--   AR 1100:              delta_total    > 0 -> Dr delta_total
--                          delta_total    < 0 -> Cr abs(delta_total)
--   Revenue / Refunds:     delta_subtotal > 0 -> Cr 4000 delta_subtotal
--                          delta_subtotal < 0 -> Dr 4950 abs(delta_subtotal)
--   Sales Tax Payable 2100: delta_tax     > 0 -> Cr delta_tax
--                          delta_tax      < 0 -> Dr abs(delta_tax)
--   Sales Discounts 4900:  delta_discount > 0 -> Dr delta_discount
--                          delta_discount < 0 -> Cr abs(delta_discount)
--
-- BALANCE PROOF: treating each line's net DEBIT contribution as a single
-- signed value regardless of which side it posts to -- AR contributes
-- delta_total, Revenue/Refunds contributes -delta_subtotal, Tax
-- contributes -delta_tax, Discount contributes +delta_discount -- the
-- entry's total net debit effect is:
--   delta_total - delta_subtotal - delta_tax + delta_discount
-- which is identically zero because delta_total is DEFINED as
-- delta_subtotal + delta_tax - delta_discount above. This holds for every
-- sign combination (all 8 phases from the checkpoint brief's own
-- worked-scenario list: subtotal-only up/down, tax-only up/down,
-- discount-only up/down, combined changes, zero-net-total component
-- changes, and a correction to exactly zero), not just the cases that
-- happen to have been hand-checked.
--
-- ANTI-OVERPAYMENT SAFETY: a downward correction may never drop
-- new_total below v_invoice.paid_minor -- the settled economic amount
-- already nets cash payments, Customer Deposit Applications (both count
-- toward paid_minor via recompute_invoice_balance's own gross-paid sum,
-- since a deposit application is itself a Payment row with
-- payment_type='adjustment' and invoice_id set), and prior refunds. This
-- refuses the correction (P1134) rather than inventing an implicit
-- refund/Customer Deposit/negative AR -- Partial-Payment Void (F2.1C-D-D,
-- not this checkpoint) is where an already-collected amount's fate on
-- cancellation is decided, per Founder decision D1.
--
-- REQUEST IDEMPOTENCY: no separate Credit/Debit Note table exists to
-- compare a stored payload against -- this checkpoint's own scope
-- explicitly excludes one (see header above). Instead: the already-posted
-- correction Journal Entry (source_type 'invoice_adjustment', source_id =
-- p_adjustment_id) durably records the REQUESTED target directly in its
-- own memo (append-only -- journal_entries' memo never changes once
-- written), parsed back out and compared against the retry's requested
-- subtotal/tax/discount on replay (P1129-style conflict on a mismatch,
-- Finance F2.1C-C-IDEMPOTENCY's established convention, reusing
-- p_adjustment_id the same way p_refund_payment_id/p_application_payment_id
-- already work).
--
-- Finance F2.1C-D-C-REVIEW: an earlier version of this design compared the
-- retry's target against the Invoice's own CURRENT fields instead of a
-- durably-recorded target. Independent review found this incorrectly
-- rejects a legitimate stale retry once a LATER, different adjustment has
-- moved the invoice on in the meantime: adjustment A (key K) sets the
-- invoice to 120000, adjustment B (a different key) later moves it to
-- 130000, and a delayed retry of K then compared its own target (120000)
-- against the CURRENT invoice (130000) -- a spurious conflict, even though
-- K's own request had already succeeded exactly as asked. Comparing
-- against the memo-recorded target instead of current state fixes this:
-- K's retry now matches K's own durable target regardless of what B did
-- afterward, and correctly replays (returning the Invoice's CURRENT state
-- — honestly reflecting that time has passed and other legitimate
-- operations may have run since, not a stale snapshot of K's own effect
-- alone).
--
-- ATOMICITY / LOCKING: the Invoice row is locked `for update` before the
-- replay/conflict check (closing the same class of race F2.1C-B-REVIEW's
-- invoice lock closes for concurrent refunds) and held for the rest of the
-- function -- the Journal Entry insert, the invoices UPDATE, and the
-- recompute_invoice_balance call (which itself re-locks the SAME row --
-- safe, Postgres row locks are reentrant within one transaction) all run
-- inside this ONE transaction. No state can commit where the Journal
-- Entry posted but the Invoice fields weren't updated, or vice versa.
--
-- ACCOUNTING PERIOD: posts via finance_insert_journal_entry with
-- p_entry_date = current date (never caller-supplied, never backdated
-- into the original issue period) -- that helper resolves the current
-- open accounting period itself and the existing
-- finance_check_period_open_for_posting trigger rejects posting into a
-- locked/closed period exactly as it already does for every other Finance
-- posting. No period-reopening mechanism is added.
--
-- Widens journal_entries_source_type_check to add exactly one new value,
-- 'invoice_adjustment' -- the same drop/add pattern every prior widening
-- in this schema uses (20260804100300, 20260804100500, 20260821100100,
-- 20260824100000). Every one of the 20 pre-existing values is preserved
-- verbatim.
--
-- Scope boundary: this migration does NOT implement Partial-Payment Void
-- (F2.1C-D-D), Deposit Application reversal, historical backfill,
-- reconciliation activation, a Credit Note or Debit Note table, document
-- snapshots, or any new Invoice status. It does not modify
-- post_payment_refund_reversal, process_payment_refund,
-- record_deposit_application, post_deposit_application, or any
-- already-committed migration file.

alter table public.journal_entries drop constraint journal_entries_source_type_check;
alter table public.journal_entries
  add constraint journal_entries_source_type_check check (
    source_type in (
      'purchase_receipt', 'invoice_issued', 'invoice_voided', 'payment_settlement', 'payment_refund',
      'expense_due', 'expense_paid', 'expense_reimbursed', 'expense_due_reversal',
      'inventory_adjustment', 'inventory_writeoff', 'inventory_event_checkout', 'inventory_event_return',
      'inventory_initial_stock', 'vendor_payment', 'vendor_refund', 'stripe_payout', 'manual_adjustment',
      'reversal', 'deposit_application', 'invoice_adjustment'
    )
  );

create or replace function public.record_invoice_adjustment(
  p_invoice_id uuid,
  p_subtotal_minor integer,
  p_tax_minor integer,
  p_discount_minor integer,
  p_reason text,
  p_adjustment_id uuid,
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
  v_old_subtotal integer;
  v_old_tax integer;
  v_old_discount integer;
  v_new_total integer;
  v_delta_subtotal integer;
  v_delta_tax integer;
  v_delta_discount integer;
  v_delta_total integer;
  v_lines jsonb;
  v_posting_key text;
  v_recomputed public.invoices;
  v_replay_subtotal integer;
  v_replay_tax integer;
  v_replay_discount integer;
begin
  if p_adjustment_id is null then
    raise exception 'p_adjustment_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same adjustment request).'
      using errcode = 'P1130';
  end if;

  if p_subtotal_minor is null or p_subtotal_minor < 0
    or p_tax_minor is null or p_tax_minor < 0
    or p_discount_minor is null or p_discount_minor < 0
    or p_discount_minor > p_subtotal_minor
  then
    raise exception 'Please enter a valid corrected subtotal, tax, and discount (non-negative, discount not exceeding the subtotal).'
      using errcode = 'P1135';
  end if;

  -- Same lock-before-replay-check pattern F2.1C-B-REVIEW established for
  -- concurrent refunds against the same invoice -- see this migration's
  -- header comment for the full atomicity/locking rationale.
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  -- Finance F2.1C-D-C-REVIEW: compares against the REQUESTED target parsed
  -- back out of the existing entry's own memo (durable -- journal_entries
  -- is append-only, this memo never changes), NOT against v_invoice's
  -- current fields. Comparing against current fields (the original
  -- F2.1C-D-C design) was found, on independent review, to incorrectly
  -- reject a legitimate stale retry once a LATER, different adjustment had
  -- moved the invoice on in the meantime: adjustment A (key K) sets the
  -- invoice to 120000, adjustment B (a different key) later moves it to
  -- 130000, and a delayed retry of K then compared its own target
  -- (120000) against the CURRENT invoice (130000) -- a spurious mismatch,
  -- even though K's own request had already succeeded exactly as asked.
  select * into v_existing_entry
  from public.journal_entries
  where source_type = 'invoice_adjustment' and source_id = p_adjustment_id::text;

  if found then
    v_replay_subtotal := substring(v_existing_entry.memo from 'subtotal_minor=(-?\d+)')::integer;
    v_replay_tax := substring(v_existing_entry.memo from 'tax_minor=(-?\d+)')::integer;
    v_replay_discount := substring(v_existing_entry.memo from 'discount_minor=(-?\d+)')::integer;
    if v_replay_subtotal = p_subtotal_minor and v_replay_tax = p_tax_minor and v_replay_discount = p_discount_minor then
      return v_invoice;
    end if;
    raise exception 'This idempotency key was already used for a different adjustment request.' using errcode = 'P1129';
  end if;

  if v_invoice.status not in ('issued', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue') then
    if v_invoice.status = 'draft' then
      raise exception 'Draft invoices are not yet issued — use the normal invoice edit instead of a financial adjustment.' using errcode = 'P1132';
    end if;
    raise exception 'Cannot financially adjust an invoice that is %.', v_invoice.status using errcode = 'P1132';
  end if;

  v_old_subtotal := v_invoice.subtotal_minor;
  v_old_tax := v_invoice.tax_minor;
  v_old_discount := v_invoice.discount_minor;
  v_new_total := p_subtotal_minor + p_tax_minor - p_discount_minor;

  if p_subtotal_minor = v_old_subtotal and p_tax_minor = v_old_tax and p_discount_minor = v_old_discount then
    raise exception 'No financial change was requested — the corrected subtotal, tax, and discount all match the invoice''s current values.' using errcode = 'P1133';
  end if;

  -- Finance F2.1C-D-C: the settled economic amount is exactly paid_minor
  -- (see this migration's header comment) -- a downward correction may
  -- never drop the total below what has genuinely already been collected.
  if v_new_total < v_invoice.paid_minor then
    raise exception 'Cannot reduce the invoice below the amount already collected (% minor units). Refund the excess first.', v_invoice.paid_minor
      using errcode = 'P1134';
  end if;

  v_delta_subtotal := p_subtotal_minor - v_old_subtotal;
  v_delta_tax := p_tax_minor - v_old_tax;
  v_delta_discount := p_discount_minor - v_old_discount;
  v_delta_total := v_delta_subtotal + v_delta_tax - v_delta_discount;

  v_posting_key := 'invoice_adjustment:' || p_adjustment_id;
  v_lines := '[]'::jsonb;

  if v_delta_total > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 1100)).id,
      'debit_minor', v_delta_total, 'credit_minor', 0
    ));
  elsif v_delta_total < 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 1100)).id,
      'debit_minor', 0, 'credit_minor', -v_delta_total
    ));
  end if;

  if v_delta_subtotal > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4000)).id,
      'debit_minor', 0, 'credit_minor', v_delta_subtotal
    ));
  elsif v_delta_subtotal < 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4950)).id,
      'debit_minor', -v_delta_subtotal, 'credit_minor', 0
    ));
  end if;

  if v_delta_tax > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 2100)).id,
      'debit_minor', 0, 'credit_minor', v_delta_tax
    ));
  elsif v_delta_tax < 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 2100)).id,
      'debit_minor', -v_delta_tax, 'credit_minor', 0
    ));
  end if;

  if v_delta_discount > 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4900)).id,
      'debit_minor', v_delta_discount, 'credit_minor', 0
    ));
  elsif v_delta_discount < 0 then
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4900)).id,
      'debit_minor', 0, 'credit_minor', -v_delta_discount
    ));
  end if;

  perform public.finance_insert_journal_entry(
    v_invoice.workspace_id,
    current_date,
    'invoice_adjustment',
    p_adjustment_id::text,
    format(
      'Invoice financial adjustment target: subtotal_minor=%s tax_minor=%s discount_minor=%s. Was subtotal %s→%s, tax %s→%s, discount %s→%s. Reason: %s',
      p_subtotal_minor, p_tax_minor, p_discount_minor,
      v_old_subtotal, p_subtotal_minor, v_old_tax, p_tax_minor, v_old_discount, p_discount_minor, p_reason
    ),
    p_actor,
    null,
    v_posting_key,
    v_lines
  );

  update public.invoices
  set subtotal_minor = p_subtotal_minor,
      tax_minor = p_tax_minor,
      discount_minor = p_discount_minor,
      total_minor = v_new_total,
      updated_at = now()
  where id = p_invoice_id;

  -- Finance F2.1C-D-C: paid_minor is unaffected by an adjustment (no
  -- Payment row is touched), but balance_minor/status must be recomputed
  -- against the newly-corrected total_minor -- reusing the existing,
  -- already-reviewed recompute_invoice_balance rather than re-deriving its
  -- status-transition rules a second time. Same-row `for update` re-lock
  -- is safe (Postgres row locks are reentrant within one transaction).
  v_recomputed := public.recompute_invoice_balance(p_invoice_id, p_actor);

  return v_recomputed;
end;
$$;

comment on function public.record_invoice_adjustment(uuid, integer, integer, integer, text, uuid, text) is
  'Finance F2.1C-D-C: post-issuance financial correction for an Invoice in {issued, sent, viewed, partially_paid, paid, overdue} (draft uses updateInvoice instead; voided/archived are terminal, P1132). Changes subtotal_minor/tax_minor/discount_minor to the caller''s requested values (total_minor is always server-derived, currency is never accepted as input and stays permanently immutable), posts one balanced append-only Journal Entry (source_type ''invoice_adjustment'') carrying the signed delta against 1100 AR / 4000 Revenue or 4950 Refunds & Returns / 2100 Sales Tax Payable / 4900 Sales Discounts, then recomputes paid_minor/balance_minor/status via recompute_invoice_balance. Rejects a no-op (P1133, all three fields already match), a downward correction that would drop the total below the amount already collected via cash payment or Customer Deposit Application (P1134 — refund the excess first), and invalid financial values (P1135, defensive — unreachable via the TS repository''s own schema validation). Idempotent per p_adjustment_id: a replay with the SAME target values (durably compared against the target recorded in the existing entry''s own memo, NOT the Invoice''s current fields — F2.1C-D-C-REVIEW, see this migration''s header comment) returns the Invoice unchanged, correctly even after a later, different adjustment has since moved the Invoice on further (P1129 on a genuine payload mismatch under the same key).';
