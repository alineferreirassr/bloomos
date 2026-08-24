-- Finance F2.1C-B migration: refund Revenue correction, replacing P1120's
-- blanket rejection with the real accounting posting F2.1C-A designed.
--
-- Two functions are redefined in place, per the approved architecture
-- (extend the EXISTING post_payment_refund_reversal identity — no second
-- refund posting identity, no new source_type/posting_key):
--
--   process_payment_refund -- the P1120 pre-check ("Cannot refund a payment
--   linked to an invoice with recognized Revenue") is REMOVED. Every other
--   line is unchanged from the F2.1B-REVIEW version.
--
--   post_payment_refund_reversal -- gains the Revenue-side correction,
--   composed into the SAME journal entry as the existing Cash/AR
--   settlement reversal (same source_type='payment_refund', same
--   posting_key='payment_refund:<refund_payment_id>' -- no new identity).
--
-- Formula (derived and balance-proven in F2.1C-A, CORRECTED in F2.1C-B-
-- REVIEW for the multi-refund case -- see that revision's note below). Let
-- R = the refund's own amount_minor, and subtotal/tax/discount/total be
-- the linked invoice's CURRENT fields (guaranteed to still match what
-- post_invoice_revenue_recognition originally posted, since F2.1B-REVIEW's
-- post-issuance edit guard makes those fields immutable once issued --
-- F2.1C-D, not yet built, is the only future path that could change this
-- invariant):
--
--   tax_portion      = round(R * tax_minor / total_minor)
--   discount_portion = round(R * discount_minor / total_minor)
--   revenue_portion  = R + discount_portion - tax_portion   -- residual,
--                       NOT independently rounded -- this is what
--                       guarantees the entry balances to the exact minor
--                       unit regardless of how tax_portion/discount_portion
--                       individually round, rather than three independently
--                       -rounded shares that could mismatch by 1-2 cents.
--
-- F2.1C-B-REVIEW correction: the formula above, applied independently to
-- EACH refund's own amount_minor R, guarantees only that a SINGLE entry
-- balances internally -- it does NOT guarantee that N partial refunds
-- summing to the full invoice total reproduce the same cumulative
-- Tax Payable / Sales Discounts / net-Revenue effect as one single full
-- refund. Confirmed by simulation: subtotal=100000/tax=5000/discount=2000/
-- total=103000, refunded as three partials (30000+40000+33000=103000),
-- left net Revenue and net Sales Discounts each off by 1 cent, even though
-- every individual entry balanced on its own (independent per-refund
-- rounding of tax_portion/discount_portion doesn't cancel across separate
-- rounding operations the way it does within one). The fix: R below is
-- replaced by CUMULATIVE totals, and each portion is the DIFFERENCE from
-- the previous cumulative state, not an independent per-refund
-- computation --
--
--   R_cum   = (sum of every OTHER completed refund payment linked to this
--              invoice) + this refund's own amount_minor
--   R_prior = R_cum - this refund's own amount_minor
--   tax_portion_cum/prior, discount_portion_cum/prior, revenue_portion_
--     cum/prior = the SAME three formulas above, evaluated at R_cum and at
--     R_prior respectively
--   tax_portion      = tax_portion_cum      - tax_portion_prior
--   discount_portion = discount_portion_cum - discount_portion_prior
--   revenue_portion  = revenue_portion_cum  - revenue_portion_prior
--
-- This still balances every individual entry (revenue_portion_cum -
-- revenue_portion_prior telescopes algebraically to exactly R + discount_
-- portion - tax_portion for THIS refund, by the same identity as before),
-- AND telescopes the running total to exactly tax_minor/discount_minor/
-- subtotal_minor once R_cum reaches total_minor -- verified by simulation
-- across 2-way, 3-way, 7-way, and adversarial 10-way-equal-split refund
-- sequences, all landing at exactly zero drift, where independent
-- per-refund rounding did not.
--
-- Combined entry (existing 2 lines preserved verbatim, exactly as F1.8
-- built them; new lines appended only when the linked invoice has an
-- unreversed Revenue-recognition entry -- i.e. exactly the same condition
-- P1120 used to check, now a branch instead of a rejection):
--
--   Dr [existing credit_line account: 1100 AR]         R        (unchanged)
--   Cr [existing cash_line account: 1000 Cash]          R        (unchanged)
--   Dr 4950 Refunds & Returns                    revenue_portion (new)
--   Dr 2100 Sales Tax Payable                    tax_portion, if > 0 (new)
--   Cr 4900 Sales Discounts                      discount_portion, if > 0 (new)
--   Cr 1100 Accounts Receivable                          R        (new)
--
-- The new "Cr AR = R" line exactly cancels the existing "Dr AR = R" line
-- (same account, same amount, opposite sides) -- deliberately NOT
-- collapsed into a single omitted pair: appending to the untouched,
-- already-proven F1.8 lines is lower-risk than restructuring them, and
-- keeps the diff a pure addition. Account 4000 Service Revenue is never
-- touched directly by this correction -- 4950 (contra-revenue) preserves
-- gross-Revenue visibility while producing the identical net effect on the
-- P&L, since buildProfitAndLossSections already nets contra-revenue
-- against revenue.
--
-- Non-invoice-linked (Customer Deposits) refunds are entirely unaffected:
-- the condition that gates the new lines checks invoice_id is not null
-- AND an unreversed invoice_issued entry exists, exactly mirroring the
-- retired P1120 check -- when neither holds, the entry is exactly the
-- pre-F2.1B-REVIEW 2-line reversal, byte-for-byte.
--
-- Negative-residual safety: revenue_portion could only go negative under a
-- malformed invoice (tax_minor + something exceeding total_minor, which
-- Invoice validation already prevents at creation/issuance time -- see
-- schema.ts's discount<=subtotal check and the non-negative integer
-- constraints already enforced elsewhere). A defensive check still guards
-- against it explicitly (P1121) rather than silently posting a negative
-- debit.

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
  v_lines jsonb;
  v_recognition_entry public.journal_entries;
  v_invoice public.invoices;
  v_tax_portion integer;
  v_discount_portion integer;
  v_revenue_portion integer;
  v_prior_refunded_total integer;
  v_cumulative_refunded_total integer;
  v_tax_cum integer;
  v_discount_cum integer;
  v_revenue_cum integer;
  v_tax_prior integer;
  v_discount_prior integer;
  v_revenue_prior integer;
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

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_credit_line.account_id, 'debit_minor', v_refund.amount_minor, 'credit_minor', 0),
    jsonb_build_object('account_id', v_cash_line.account_id, 'debit_minor', 0, 'credit_minor', v_refund.amount_minor)
  );

  -- Finance F2.1C-B: compose the Revenue-side correction into this SAME
  -- entry, exactly when the refunded payment is invoice-linked and that
  -- invoice still has an unreversed Revenue-recognition entry -- the same
  -- condition F2.1B-REVIEW's now-retired P1120 guard used to reject on.
  if v_refund.invoice_id is not null then
    select * into v_recognition_entry
    from public.journal_entries
    where source_type = 'invoice_issued'
      and source_id = v_refund.invoice_id::text
      and reversed_by_entry_id is null;

    if found then
      -- Finance F2.1C-B-REVIEW: `for update` locks the invoice row for the
      -- duration of this transaction -- same convention as recompute_
      -- invoice_balance's own invoice lock. Required because the
      -- cumulative sum just below reads across EVERY payment linked to
      -- this invoice, not just the one original payment process_payment_
      -- refund already locked -- without this, two refunds against the
      -- SAME invoice via two DIFFERENT original payments could run
      -- concurrently, each computing "prior refunded total" from a
      -- snapshot that doesn't see the other's in-flight refund, and post
      -- overlapping/incorrect portions -- the same kind of drift the
      -- cumulative-then-diff formula exists to prevent, reintroduced via a
      -- race instead of independent rounding. No new lock-order cycle:
      -- process_payment_refund already holds a payments-row lock before
      -- calling here, and nothing elsewhere in this Finance domain locks
      -- invoices before payments in the same transaction.
      select * into v_invoice from public.invoices where id = v_refund.invoice_id for update;

      -- Cumulative-then-diff, not independent per-refund rounding -- see
      -- the header comment's derivation. Sums every OTHER completed
      -- refund payment already linked to this invoice (across any of its
      -- payments, not just this refund's own original payment), so this
      -- stays correct even when an invoice was collected via multiple
      -- separate payments each later refunded.
      select coalesce(sum(amount_minor), 0) into v_prior_refunded_total
      from public.payments
      where invoice_id = v_refund.invoice_id
        and payment_type = 'refund'
        and id <> v_refund.id
        and status in ('succeeded', 'partially_refunded', 'refunded');

      v_cumulative_refunded_total := v_prior_refunded_total + v_refund.amount_minor;

      v_tax_cum := round((v_cumulative_refunded_total::numeric * v_invoice.tax_minor) / v_invoice.total_minor);
      v_discount_cum := round((v_cumulative_refunded_total::numeric * v_invoice.discount_minor) / v_invoice.total_minor);
      v_revenue_cum := v_cumulative_refunded_total + v_discount_cum - v_tax_cum;

      v_tax_prior := round((v_prior_refunded_total::numeric * v_invoice.tax_minor) / v_invoice.total_minor);
      v_discount_prior := round((v_prior_refunded_total::numeric * v_invoice.discount_minor) / v_invoice.total_minor);
      v_revenue_prior := v_prior_refunded_total + v_discount_prior - v_tax_prior;

      v_tax_portion := v_tax_cum - v_tax_prior;
      v_discount_portion := v_discount_cum - v_discount_prior;
      v_revenue_portion := v_revenue_cum - v_revenue_prior;

      if v_revenue_portion < 0 then
        raise exception 'Unable to compute a balanced refund correction for this invoice.' using errcode = 'P1121';
      end if;

      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4950)).id,
          'debit_minor', v_revenue_portion, 'credit_minor', 0
        )
      );

      if v_tax_portion > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 2100)).id,
            'debit_minor', v_tax_portion, 'credit_minor', 0
          )
        );
      end if;

      if v_discount_portion > 0 then
        v_lines := v_lines || jsonb_build_array(
          jsonb_build_object(
            'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4900)).id,
            'debit_minor', 0, 'credit_minor', v_discount_portion
          )
        );
      end if;

      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object('account_id', v_credit_line.account_id, 'debit_minor', 0, 'credit_minor', v_refund.amount_minor)
      );
    end if;
  end if;

  v_entry := public.finance_insert_journal_entry(
    v_refund.workspace_id,
    v_refund.transaction_date,
    'payment_refund',
    p_refund_payment_id::text,
    'Refund reversal of payment settlement ' || v_settlement_entry.id::text || ' (' || v_refund.amount_minor::text || ' minor units)',
    p_actor,
    null,
    v_posting_key,
    v_lines
  );

  return v_entry;
end;
$$;

comment on function public.post_payment_refund_reversal(uuid, uuid, text) is
  'Posts a PARTIAL, proportional reversal of a payment settlement for one refund event: Dr [original credit account: 1100 AR or 2200 Customer Deposits] / Cr 1000 Cash, for the refund''s own amount_minor. Finance F2.1C-B: when the refund is invoice-linked and that invoice has unreversed recognized Revenue, additionally composes into the SAME entry: Dr 4950 Refunds & Returns + Dr 2100 Sales Tax Payable (if any) + Cr 4900 Sales Discounts (if any) + Cr 1100 AR (netting the settlement-reversal''s own AR debit to zero) -- replacing the F2.1B-REVIEW P1120 blanket rejection with the real correction. Finance F2.1C-B-REVIEW: the three portions are computed CUMULATIVELY against every completed refund linked to this invoice (this one plus all others, regardless of which original payment they refunded) and taken as the difference from the previous cumulative state, not rounded independently per refund -- independent per-refund rounding let 3+ partial refunds summing to the full invoice amount drift the net Revenue/Sales Discounts balance by 1+ cents versus a single full refund; the cumulative-then-diff technique telescopes to exactly zero drift once the running total reaches the invoice total, however many refund events occur -- protected against a concurrent-refund race by locking the invoice row (`for update`, same convention as recompute_invoice_balance) before computing the cumulative total, since it reads across every payment linked to the invoice, not just the one payments-row process_payment_refund already locked. Account routing for the unchanged lines is read back from the original settlement''s actual posted journal_lines, not re-derived. Fails with P1118 (never invents a reversal) if no payment_settlement entry exists, and P1121 if the correction cannot be computed as balanced. Idempotent per refund row via posting_key ''payment_refund:<refund_payment_id>''.';

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

  perform public.post_payment_refund_reversal(v_refund.id, v_original.id, p_actor);

  return v_refund;
end;
$$;

comment on function public.process_payment_refund(uuid, integer, text) is
  'Atomic, row-locked equivalent of the mock''s refundPayment() -- validates the refundable ceiling against prior refunds, inserts the refund Payment, updates the original''s status, logs Timeline, and posts the settlement (+ Revenue correction where applicable) reversal via post_payment_refund_reversal -- all in one transaction. Finance F2.1C-B: the F2.1B-REVIEW P1120 blanket rejection is REMOVED -- invoice-linked refunds against recognized Revenue are now correctly posted instead of blocked. Fails safely (P1118) rather than inventing a reversal for a payment with no settlement entry, unchanged from F1.8.';
