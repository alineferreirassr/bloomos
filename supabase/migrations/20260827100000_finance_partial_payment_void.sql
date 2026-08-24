-- Finance F2.1C-D-D-B: Partial-Payment Void / Cancellation.
--
-- Unifies Invoice void/cancellation into one operation with two branches,
-- finalizing the architecture designed in F2.1C-D-D-A:
--
--   Case A (paid_minor = 0): unchanged CLEAN VOID -- the entire
--   invoice_issued recognition is fully reversed via the existing
--   post_invoice_voided_reversal, exactly as before this migration.
--
--   Case B (0 < paid_minor and balance_minor > 0): NEW Partial-Payment
--   Cancellation -- the settled economic portion (already-collected cash
--   payments + Customer Deposit Applications, netted of any prior refund)
--   stays recognized Revenue; only the genuinely unpaid CURRENT remainder
--   is cancelled via one balanced append-only Journal Entry (source_type
--   'invoice_partial_void'). Cash and Customer Deposits are never touched,
--   no automatic refund or deposit is created.
--
--   Case C (balance_minor = 0 while paid_minor > 0): rejected (P1136) --
--   nothing left to cancel; use a refund or an invoice financial
--   adjustment instead. Reachable specifically for an invoice that reached
--   balance_minor = 0 while in a status recompute_invoice_balance's own
--   status-transition list does not cover (e.g. 'issued'/'draft', which
--   never auto-promote to 'paid') -- for every other status, reaching
--   balance_minor = 0 already atomically transitions status to 'paid',
--   which the pre-existing status-eligibility check below already blocks
--   with its own P1105 message before this case is ever reached.
--
-- ALLOCATION BASIS (Founder-locked, F2.1C-D-D-A): the Invoice's CURRENT
-- economic fields -- deliberately the OPPOSITE of refund's own basis
-- (the immutable original invoice_issued recognition). Refund needs a
-- FIXED basis because multiple refund events must sum consistently
-- against it (F2.1C-D-B's whole point). Partial-Payment Void has no such
-- multi-event problem: it is a single, terminal, one-time operation (the
-- Invoice becomes 'voided' -- terminal -- the instant it succeeds, so a
-- second void attempt can never happen), and correctness requires
-- cancelling proportional to what is ACTUALLY still billed right now --
-- using the ORIGINAL basis after a rate-changing Invoice Adjustment could
-- even compute a NEGATIVE resulting tax/discount field. Proven safe by
-- construction: tax_cancelled/discount_cancelled can equal but never
-- exceed the invoice's current tax_minor/discount_minor, since
-- cancellable_minor is always strictly less than total_minor (partial
-- void requires paid_minor > 0).
--
-- CANCELLATION FORMULA (same residual/cumulative-diff-style technique
-- Invoice Financial Adjustment already established, applied toward a
-- server-computed target -- the settled amount -- rather than a
-- caller-supplied one):
--   cancellable_minor    = total_minor - paid_minor  (== balance_minor,
--                           guaranteed by the pre-existing
--                           invoices_paid_check constraint: paid_minor <=
--                           total_minor always holds, so the floor in
--                           calculateBalance/GREATEST(0, ...) never
--                           actually clamps)
--   tax_cancelled         = round(cancellable_minor * tax_minor / total_minor)
--   discount_cancelled    = round(cancellable_minor * discount_minor / total_minor)
--   subtotal_cancelled    = cancellable_minor + discount_cancelled - tax_cancelled
--
-- Posted (Cash 1000 and Customer Deposits 2200: NO LINE; Service Revenue
-- 4000: NO DIRECT REVERSAL):
--   Dr 4950 Refunds & Returns   subtotal_cancelled
--   Dr 2100 Sales Tax Payable   tax_cancelled     (only when > 0)
--   Cr 4900 Sales Discounts     discount_cancelled (only when > 0)
--   Cr 1100 Accounts Receivable cancellable_minor
-- Balances by construction: subtotal_cancelled + tax_cancelled -
-- discount_cancelled = cancellable_minor identically, the same algebraic
-- invariant already proven for Invoice Financial Adjustment's own delta
-- formula (this IS that formula, applied toward a fixed target).
--
-- POST-CANCELLATION INVOICE FIELDS: new_subtotal/new_tax/new_discount are
-- the CURRENT fields minus their _cancelled portion; new_total is set to
-- exactly paid_minor (by construction: new_total = total_minor -
-- cancellable_minor = total_minor - (total_minor - paid_minor) =
-- paid_minor). paid_minor itself is UNCHANGED (no Payment row is
-- touched). status is set to 'voided' and voided_at to now().
--
-- CRITICAL ORDERING: the Invoice's economic fields and status='voided'
-- are updated in ONE statement BEFORE calling recompute_invoice_balance.
-- recompute_invoice_balance's own status-transition logic only fires for
-- status in {sent, viewed, partially_paid, paid, overdue} -- calling it
-- with status already 'voided' (not in that list) correctly leaves
-- 'voided' untouched while still recomputing balance_minor (which becomes
-- exactly 0, since new_total now equals paid_minor) against the
-- newly-corrected total_minor. Reversing this order -- recomputing BEFORE
-- setting 'voided' -- would be unsafe: with status still e.g.
-- 'partially_paid' and the new total already equal to paid_minor,
-- recompute_invoice_balance would itself transition status to 'paid'
-- instead of leaving it for this function's own 'voided' write.
--
-- CUSTOMER DEPOSIT APPLICATION BLOCKER (Founder-locked D2, F2.1C-D-D-A):
-- any Payment row linked to this invoice with payment_type = 'adjustment'
-- and reference like 'deposit_application_of:%' in a paid-counting status
-- unconditionally blocks void (P1137) -- no Deposit Application reversal
-- capability exists yet to un-strand the deposit's own 2200 Customer
-- Deposits ledger position. A deposit-application Payment row is not
-- itself refundable through the existing refund path at all (its
-- source_type is 'deposit_application', not 'payment_settlement', so
-- process_payment_refund's own settlement lookup already rejects it via
-- P1118) -- there is no "already resolved" state to distinguish, any such
-- row blocks unconditionally.
--
-- REQUEST IDEMPOTENCY (F2.1C-D-C-REVIEW's durable-memo lesson, applied
-- from the start rather than discovered after the fact this time): scoped
-- to the Partial-Payment Cancellation path only -- clean void's own
-- existing idempotency (a hard reject on retry, via the pre-existing
-- status-eligibility check + post_invoice_voided_reversal's own internal
-- P1104 duplicate-posting guard) is deliberately UNCHANGED, preserving
-- "existing clean-void behavior" literally. The partial-cancellation
-- Journal Entry's memo durably records invoice_id (append-only --
-- journal_entries' memo never changes once written), parsed back out and
-- compared on replay. Because Partial-Payment Void is terminal (the
-- Invoice can never be voided a second time), there is no F2.1C-D-C-style
-- "a later legitimate operation moves the state further" risk to guard
-- against for THIS specific replay -- the durable-memo check here exists
-- specifically to correctly reject cross-invoice key reuse rather than to
-- survive intervening mutations (which cannot occur once terminal). The
-- replay/conflict check runs BEFORE the ordinary status-eligibility
-- rejection, so a genuine retry of an already-succeeded cancellation
-- replays correctly instead of failing merely because the Invoice is now
-- (correctly) voided.
--
-- ACCOUNTING PERIOD: posts via finance_insert_journal_entry with
-- current_date, exactly like every other Finance posting -- never
-- caller-supplied, never backdated into the original issue period.
--
-- Widens journal_entries_source_type_check to add exactly one new value,
-- 'invoice_partial_void' -- the same drop/add pattern every prior
-- widening in this schema uses. Every one of the 21 pre-existing values
-- (20 original + F2.1C-D-C's own 'invoice_adjustment') is preserved
-- verbatim.
--
-- MANDATORY REFUND TERMINAL-STATUS GUARD (discovered during F2.1C-D-D-A's
-- own architecture review, directly required by this migration's
-- existence): post_payment_refund_reversal never checked the linked
-- Invoice's status at all -- immaterial before Partial-Payment Void
-- existed, since only a zero-paid Invoice could ever reach 'voided'. Now
-- a PAID Invoice can also become terminal, and its economic fields must
-- stay permanently frozen once voided -- refunding against it afterward
-- would incorrectly continue mutating a supposedly-final state. Redefined
-- below with the SAME (uuid, uuid, text) signature, adding exactly one
-- new guard (P1139) immediately after the existing Invoice row lock, no
-- other line changed.
--
-- Also fixes a real, independently-discovered gap in the already-pushed
-- F2.1C-D-C migration: record_invoice_adjustment never wrote a Timeline
-- entry at all (neither server-side nor client-side), unlike every other
-- money-mutating Finance RPC (post_payment_refund_reversal,
-- post_deposit_application both write timeline_activities server-side,
-- inside their own transaction) -- the mock's own recordInvoiceAdjustment
-- DOES write one, a real mock/Supabase parity gap that survived
-- F2.1C-D-C-REVIEW. Redefined below with the SAME (uuid, integer,
-- integer, integer, text, uuid, text) signature and otherwise-unchanged
-- logic, adding exactly one new `insert into timeline_activities`
-- statement, matching refund/deposit-application's own established
-- pattern. F2.1C-D-C's own committed/pushed migration file is not
-- modified -- this is a new, later migration expressing the correction,
-- per this whole project's "never edit an already-pushed migration"
-- discipline.
--
-- Scope boundary: this migration does NOT implement Deposit Application
-- reversal, historical backfill, reconciliation activation, report
-- redesign, or any new Invoice status. It does not modify
-- process_payment_refund, record_deposit_application,
-- post_deposit_application, issue_invoice_and_post_revenue_recognition,
-- or any migration file other than the two functions it explicitly
-- redefines above.

alter table public.journal_entries drop constraint journal_entries_source_type_check;
alter table public.journal_entries
  add constraint journal_entries_source_type_check check (
    source_type in (
      'purchase_receipt', 'invoice_issued', 'invoice_voided', 'payment_settlement', 'payment_refund',
      'expense_due', 'expense_paid', 'expense_reimbursed', 'expense_due_reversal',
      'inventory_adjustment', 'inventory_writeoff', 'inventory_event_checkout', 'inventory_event_return',
      'inventory_initial_stock', 'vendor_payment', 'vendor_refund', 'stripe_payout', 'manual_adjustment',
      'reversal', 'deposit_application', 'invoice_adjustment', 'invoice_partial_void'
    )
  );

-- ---------------------------------------------------------------------------
-- post_payment_refund_reversal — adds the terminal-status guard (P1139).
-- Every other line is byte-for-byte identical to 20260825100000's version.
-- ---------------------------------------------------------------------------

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
      -- invoice_balance's own invoice lock.
      select * into v_invoice from public.invoices where id = v_refund.invoice_id for update;

      -- Finance F2.1C-D-D-B: an already-terminal (voided/archived) Invoice's
      -- economic fields must stay permanently frozen -- this guard is what
      -- Partial-Payment Void's own existence directly requires (see this
      -- migration's header comment). Checked immediately after the lock,
      -- before any computation, so nothing below ever mutates a terminal
      -- Invoice's fields.
      if v_invoice.status in ('voided', 'archived') then
        raise exception 'Cannot refund a payment linked to an invoice that is %.', v_invoice.status using errcode = 'P1139';
      end if;

      -- Finance F2.1C-D-B: the proportional formula's basis is read FRESH
      -- from the ORIGINAL invoice_issued entry's own posted lines --
      -- resolved by account NUMBER, NEVER from v_invoice.tax_minor/
      -- discount_minor/total_minor, which this function now separately
      -- decrements below. See 20260825100000's header comment for the
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
  'Posts a PARTIAL, proportional reversal of a payment settlement for one refund event: Dr [original credit account: 1100 AR or 2200 Customer Deposits] / Cr 1000 Cash, for the refund''s own amount_minor. Finance F2.1C-B: when the refund is invoice-linked and that invoice has unreversed recognized Revenue, additionally composes into the SAME entry: Dr 4950 Refunds & Returns + Dr 2100 Sales Tax Payable (if any) + Cr 4900 Sales Discounts (if any) + Cr 1100 AR (netting the settlement-reversal''s own AR debit to zero). Finance F2.1C-B-REVIEW: the three portions are computed CUMULATIVELY against every completed refund linked to this invoice and taken as the difference from the previous cumulative state. Finance F2.1C-D-B: the cumulative-then-diff formula''s basis is read from the ORIGINAL invoice_issued journal entry''s own posted lines, never from the Invoice row''s own current fields -- and this function ALSO decrements invoices.subtotal_minor/tax_minor/discount_minor/total_minor by the SAME computed portions. Finance F2.1C-D-D-B: rejects (P1139) a refund linked to an already-terminal (voided/archived) invoice -- its economic fields must stay permanently frozen once Partial-Payment Void or clean void has finalized them. Fails with P1118 (never invents a reversal) if no payment_settlement entry exists, P1121 if the Revenue-side correction cannot be computed as balanced. Idempotent per refund row via posting_key ''payment_refund:<refund_payment_id>''.';

-- ---------------------------------------------------------------------------
-- record_invoice_adjustment — adds the missing server-side Timeline write.
-- Every other line is byte-for-byte identical to 20260826100000's version.
-- ---------------------------------------------------------------------------

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

  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

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

  -- Finance F2.1C-D-D-B: fixes a real gap independently discovered while
  -- building this migration -- record_invoice_adjustment never wrote a
  -- Timeline entry at all, unlike every other money-mutating Finance RPC.
  -- See this migration's header comment.
  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (
    v_invoice.workspace_id, 'invoice', p_invoice_id, 'invoice_adjusted',
    format('Invoice financial adjustment: total %s → %s (%s)', v_invoice.total_minor, v_new_total, p_reason),
    p_actor
  );

  v_recomputed := public.recompute_invoice_balance(p_invoice_id, p_actor);

  return v_recomputed;
end;
$$;

comment on function public.record_invoice_adjustment(uuid, integer, integer, integer, text, uuid, text) is
  'Finance F2.1C-D-C: post-issuance financial correction for an Invoice in {issued, sent, viewed, partially_paid, paid, overdue} (draft uses updateInvoice instead; voided/archived are terminal, P1132). Changes subtotal_minor/tax_minor/discount_minor to the caller''s requested values, posts one balanced append-only Journal Entry (source_type ''invoice_adjustment''), then recomputes paid_minor/balance_minor/status via recompute_invoice_balance. Rejects a no-op (P1133), a downward correction below the amount already collected (P1134), and invalid financial values (P1135, defensive). Idempotent per p_adjustment_id via the target durably recorded in the existing entry''s own memo (P1129 on a genuine payload mismatch). Finance F2.1C-D-D-B: also writes an ''invoice_adjusted'' Timeline entry server-side (a real gap in the original F2.1C-D-C migration, fixed here rather than in the immutable original file).';

-- ---------------------------------------------------------------------------
-- void_invoice_and_reverse_revenue_recognition — new signature, unified
-- clean-void + Partial-Payment Cancellation branching.
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

  -- Finance F2.1C-D-D-B request idempotency: scoped to the Partial-Payment
  -- Cancellation path only. Checked BEFORE the ordinary status-eligibility
  -- rejection below so a genuine retry of an already-succeeded
  -- cancellation replays correctly instead of failing merely because the
  -- Invoice is now (correctly) voided. See this migration's header
  -- comment for the full rationale.
  select * into v_existing_entry
  from public.journal_entries
  where source_type = 'invoice_partial_void' and source_id = p_cancellation_id::text;

  if found then
    -- [^\s.]+ (not \S+) — the memo has no space between the id and its
    -- trailing period ("invoice_id=<id>. Settled..."), and a UUID never
    -- contains a period, so \S+ would greedily capture it too.
    v_replay_invoice_id := substring(v_existing_entry.memo from 'invoice_id=([^\s.]+)');
    if v_replay_invoice_id = p_invoice_id::text then
      return v_invoice;
    end if;
    raise exception 'This idempotency key was already used for a different void/cancellation request.' using errcode = 'P1129';
  end if;

  -- Unchanged from the pre-existing implementation -- draft/issued/sent/
  -- viewed/partially_paid/overdue are void-eligible at the status layer;
  -- paid/voided/archived are not.
  if v_invoice.status not in ('draft', 'issued', 'sent', 'viewed', 'partially_paid', 'overdue') then
    raise exception 'Cannot void an invoice that is already %.', v_invoice.status using errcode = 'P1105';
  end if;

  if v_invoice.paid_minor = 0 then
    -- Case A: unchanged clean-void behavior — full reversal via the
    -- pre-existing post_invoice_voided_reversal, byte-for-byte the same
    -- as before this migration.
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
  select exists (
    select 1 from public.payments
    where invoice_id = p_invoice_id
      and payment_type = 'adjustment'
      and reference like 'deposit_application_of:%'
      and status in ('succeeded', 'partially_refunded', 'refunded')
  ) into v_has_unresolved_deposit;

  if v_has_unresolved_deposit then
    raise exception 'Cannot void this invoice — it has an unresolved Customer Deposit Application. Deposit Application reversal is not yet available.'
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

  -- Fields + status='voided' in ONE statement, BEFORE recompute_invoice_
  -- balance below — see this migration's header comment for why this
  -- exact ordering is required for correctness.
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
  'Finance F2.1C-D-D-B: unified void/cancellation. If paid_minor = 0, behaves exactly as before this migration (full reversal of Revenue recognition via post_invoice_voided_reversal). If a payment has settled but a balance remains, runs Partial-Payment Cancellation instead: the settled economic portion stays recognized, only the genuinely unpaid CURRENT remainder is cancelled via one balanced append-only Journal Entry (source_type ''invoice_partial_void'', Dr 4950 Refunds & Returns + Dr 2100 Sales Tax Payable (if any) + Cr 4900 Sales Discounts (if any) + Cr 1100 AR — no Cash, no Customer Deposits, no direct Revenue 4000 reversal), then marks the Invoice voided and recomputes balance/status via recompute_invoice_balance. Rejects P1136 (fully paid, nothing to cancel), P1137 (unresolved Customer Deposit Application blocks void), P1105 (invoice already in a non-void-eligible status), P1138 (defensive, unreachable). Idempotent per p_cancellation_id, scoped to the Partial-Payment Cancellation path only — clean void''s own existing retry behavior (a hard reject) is unchanged.';
