-- Finance F2.1C-D-B migration: refund-correction Invoice-field synchronization.
--
-- THE BUG (discovered during F2.1C-D-A's architecture design, proven by
-- simulation, not assumed): whenever an invoice-linked refund posts a
-- Revenue-side correction (F2.1C-B / F2.1C-B-REVIEW), the correction's
-- netting `Cr AR` line exactly cancels the settlement-reversal's own
-- `Dr AR` line -- meaning the TRUE ledger AR after the refund is UNCHANGED
-- from what it was immediately after the original settlement (correct:
-- refunding cash that was already applied against AR doesn't reopen AR by
-- itself once Revenue has ALSO been corrected down to match). But
-- `invoices.subtotal_minor/tax_minor/discount_minor/total_minor` are never
-- touched by that correction -- they stay at the ORIGINAL, as-issued
-- values forever. recompute_invoice_balance's `balance_minor = total_minor
-- - paid_minor` formula then silently overstates what's truly owed by
-- exactly the corrected amount, because `total_minor` is stale the moment
-- ANY Revenue correction has posted. Concretely (verified by direct
-- simulation, not derivation alone):
--
--   Full payment (110000) + full refund:            true ledger AR = 0,
--     but balance_minor computed as 110000 (should be 0).
--   Partial payment (40000) + full refund of it:     true ledger AR =
--     70000, but balance_minor computed as 110000 (should be 70000).
--
-- This is a real, already-shipped defect in F2.1C-B/F2.1C-B-REVIEW,
-- discovered as a direct consequence of designing F2.1C-D (Invoice
-- Financial Adjustment / Partial-Payment Void), both of which require
-- accurate CURRENT Invoice economic terms as their starting point. Fixing
-- it is F2.1C-D-B's entire, narrow scope -- no new correction/void
-- capability is added here.
--
-- THE FIX: post_payment_refund_reversal is redefined (SAME signature,
-- uuid/uuid/text -- no cascading parameter change anywhere else, since
-- refunds/deposit-applications aren't otherwise affected) to, as part of
-- the SAME atomic operation that already computes the cumulative-then-diff
-- correction, ALSO decrement invoices.subtotal_minor/tax_minor/
-- discount_minor (and recompute total_minor) by the SAME tax_portion/
-- discount_portion/revenue_portion values the ledger posting already
-- uses -- one computation, consumed by both the Journal Entry and the
-- Invoice row, per Phase 2's single-source-of-truth requirement. Ledger
-- Journal Entries themselves are UNCHANGED and UNTOUCHED by this fix --
-- the append-only history stays exactly as it was; only the OPERATIONAL,
-- current-truth Invoice fields (which already work this way for paid_
-- minor/balance_minor/status) are synchronized to match what the ledger
-- has already recorded.
--
-- CRITICAL SECOND FINDING (Phase 5 of this checkpoint's own re-derivation,
-- confirmed by simulation, not assumed): naively using the INVOICE's
-- CURRENT (now-mutable) tax_minor/discount_minor/total_minor as the
-- cumulative-then-diff formula's PROPORTION BASIS -- the same fields this
-- fix is about to start decrementing -- silently corrupts the formula for
-- every refund AFTER the first one against the same invoice. A 2-way
-- partial refund sequence that does NOT fully drain the invoice (e.g.
-- 30000+20000 of a 100000/5000/2000/103000 invoice) was proven, by direct
-- simulation, to drift net Sales Discounts by 1 cent once the divisor
-- shrinks between refund events -- reintroducing exactly the class of
-- drift F2.1C-B-REVIEW's cumulative-then-diff technique was built to
-- eliminate, this time via a mutating basis rather than independent
-- per-refund rounding. (A 2-way split that happens to sum to the FULL
-- invoice total was checked first and appeared to coincide by an
-- algebraic accident specific to full-draining sequences -- this does NOT
-- generalize, and a non-full-draining 2-way and 3-way split both showed
-- real, if small, divergence.)
--
-- THE RESOLUTION: the proportional formula's basis (original subtotal/
-- tax/discount/total) is now read FRESH, every call, from the ORIGINAL
-- invoice_issued Journal Entry's own posted lines -- resolved by ACCOUNT
-- NUMBER (1100 AR = original total, 4000 Revenue = original subtotal,
-- 2100 Tax = original tax, 4900 Discount = original discount) via a join
-- to chart_of_accounts -- NEVER from invoices.subtotal_minor/tax_minor/
-- discount_minor/total_minor, which this same function now separately
-- decrements as its own, deliberately DECOUPLED, side effect.
-- journal_lines is append-only and immutable (no UPDATE/DELETE possible
-- per the existing posting-invariant triggers), making it the correct,
-- permanent basis regardless of how many prior corrections have already
-- decremented the Invoice's own current fields. Verified by simulation:
-- with this fix, every refund sequence (2-way full, 2-way partial, 3-way
-- full, 3-way partial) produces IDENTICAL per-refund portions to the
-- pre-existing, already-tested formula -- the ledger posting is
-- byte-for-byte unchanged; only the new Invoice-field side effect is
-- added.
--
-- Defensive guard (P1131): the computed new subtotal/tax/discount/total
-- are each checked non-negative before the UPDATE is applied. This should
-- be unreachable given the refundable ceiling already bounds cumulative
-- refunds to never exceed what was ever collected against the invoice --
-- the same "should be unreachable but never silently posts a negative
-- value" discipline P1121 already established for the Revenue-portion
-- computation itself.
--
-- Idempotency interaction: unaffected by this fix. A same-key refund
-- replay is caught by process_payment_refund's own replay check and
-- returns the existing row BEFORE post_payment_refund_reversal is ever
-- called again -- this fix's new code cannot run twice for the same
-- refund request, inherited automatically from the existing F2.1C-C-
-- IDEMPOTENCY design, not re-engineered here.
--
-- Concurrency: unaffected. The invoice row is already locked `for update`
-- (F2.1C-B-REVIEW) before the cumulative sum and correction are computed;
-- this fix's UPDATE runs against that SAME already-held lock, in the SAME
-- transaction as the Journal Entry insert -- no state can exist where the
-- ledger correction posted but the Invoice fields weren't synchronized, or
-- vice versa.
--
-- recompute_invoice_balance itself is NOT modified -- once total_minor is
-- correct BEFORE it runs, its existing `balance_minor = total_minor -
-- paid_minor` formula produces the right answer without any change.
--
-- Scope boundary: this migration does NOT implement Invoice Financial
-- Adjustment (F2.1C-D-C), Partial-Payment Void (F2.1C-D-D), Deposit
-- Application reversal, historical backfill, or reconciliation activation.
-- Deposit applications are entirely unaffected (they never touch Revenue/
-- Tax/Discount, only 2200/1100) and this migration does not modify
-- record_deposit_application or post_deposit_application in any way.

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
  v_orig_total integer;
  v_orig_subtotal integer;
  v_orig_tax integer;
  v_orig_discount integer;
  v_new_subtotal integer;
  v_new_tax integer;
  v_new_discount integer;
  v_new_total integer;
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
      -- overlapping/incorrect portions. No new lock-order cycle:
      -- process_payment_refund already holds a payments-row lock before
      -- calling here, and nothing elsewhere in this Finance domain locks
      -- invoices before payments in the same transaction.
      select * into v_invoice from public.invoices where id = v_refund.invoice_id for update;

      -- Finance F2.1C-D-B: the proportional formula's basis is read FRESH
      -- from the ORIGINAL invoice_issued entry's own posted lines --
      -- resolved by account NUMBER, NEVER from v_invoice.tax_minor/
      -- discount_minor/total_minor, which this function now separately
      -- decrements below. See this migration's header comment for the
      -- proof this decoupling matters.
      select
        coalesce(sum(jl.debit_minor) filter (where coa.account_number = 1100), 0),
        coalesce(sum(jl.credit_minor) filter (where coa.account_number = 4000), 0),
        coalesce(sum(jl.credit_minor) filter (where coa.account_number = 2100), 0),
        coalesce(sum(jl.debit_minor) filter (where coa.account_number = 4900), 0)
      into v_orig_total, v_orig_subtotal, v_orig_tax, v_orig_discount
      from public.journal_lines jl
      join public.chart_of_accounts coa on coa.id = jl.account_id
      where jl.journal_entry_id = v_recognition_entry.id;

      -- Cumulative-then-diff, not independent per-refund rounding -- see
      -- 20260823100000_finance_refund_revenue_correction.sql's header
      -- comment for the full derivation. Sums every OTHER completed
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

      v_tax_cum := round((v_cumulative_refunded_total::numeric * v_orig_tax) / v_orig_total);
      v_discount_cum := round((v_cumulative_refunded_total::numeric * v_orig_discount) / v_orig_total);
      v_revenue_cum := v_cumulative_refunded_total + v_discount_cum - v_tax_cum;

      v_tax_prior := round((v_prior_refunded_total::numeric * v_orig_tax) / v_orig_total);
      v_discount_prior := round((v_prior_refunded_total::numeric * v_orig_discount) / v_orig_total);
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

      -- Finance F2.1C-D-B: synchronize the Invoice's CURRENT economic
      -- fields with this refund's correction, so recompute_invoice_balance
      -- (called separately, after this function returns) produces a
      -- balance_minor that matches the TRUE ledger AR position. Uses
      -- v_invoice's CURRENT (possibly already-corrected-by-a-prior-refund)
      -- fields as the decrement base -- deliberately DIFFERENT from the
      -- proportional formula's basis above, which stays anchored to the
      -- ORIGINAL, immutable ledger amounts.
      v_new_subtotal := v_invoice.subtotal_minor - v_revenue_portion;
      v_new_tax := v_invoice.tax_minor - v_tax_portion;
      v_new_discount := v_invoice.discount_minor - v_discount_portion;
      v_new_total := v_new_subtotal + v_new_tax - v_new_discount;

      if v_new_subtotal < 0 or v_new_tax < 0 or v_new_discount < 0 or v_new_total < 0 then
        raise exception 'Unable to compute a balanced refund correction for this invoice.' using errcode = 'P1131';
      end if;

      update public.invoices
      set subtotal_minor = v_new_subtotal,
          tax_minor = v_new_tax,
          discount_minor = v_new_discount,
          total_minor = v_new_total,
          updated_at = now()
      where id = v_refund.invoice_id;
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
  'Posts a PARTIAL, proportional reversal of a payment settlement for one refund event: Dr [original credit account: 1100 AR or 2200 Customer Deposits] / Cr 1000 Cash, for the refund''s own amount_minor. Finance F2.1C-B: when the refund is invoice-linked and that invoice has unreversed recognized Revenue, additionally composes into the SAME entry: Dr 4950 Refunds & Returns + Dr 2100 Sales Tax Payable (if any) + Cr 4900 Sales Discounts (if any) + Cr 1100 AR (netting the settlement-reversal''s own AR debit to zero). Finance F2.1C-B-REVIEW: the three portions are computed CUMULATIVELY against every completed refund linked to this invoice and taken as the difference from the previous cumulative state. Finance F2.1C-D-B: the cumulative-then-diff formula''s basis (original subtotal/tax/discount/total) is now read from the ORIGINAL invoice_issued journal entry''s own posted lines (by account number), never from the Invoice row''s own current fields -- and this function now ALSO decrements invoices.subtotal_minor/tax_minor/discount_minor/total_minor by the SAME computed portions, so recompute_invoice_balance''s balance_minor matches the true ledger AR position instead of staying stale at the original total forever. Fails with P1118 (never invents a reversal) if no payment_settlement entry exists, P1121 if the Revenue-side correction cannot be computed as balanced, and P1131 (should be unreachable given the refundable ceiling) if the resulting Invoice fields would go negative. Idempotent per refund row via posting_key ''payment_refund:<refund_payment_id>''.';
