-- Finance F2.1B migration: Invoice Revenue Recognition — clean-case posting
-- engine (issuance recognition + void-before-any-payment reversal only).
--
-- Closes the FIN-GAP-001 gap Finance F2.0/F2.1A identified: no posting path
-- has ever credited a Revenue account, even though post_payment_settlement
-- has always credited (reduced) 1100 Accounts Receivable on an
-- invoice-linked settlement — an action that is only sensible accounting if
-- something previously debited (increased) that same account. Nothing did.
-- F2.1A's architecture decision (RECOMMENDED_REVENUE_MODEL = ACCRUAL)
-- resolves this by recognizing Revenue at invoice issuance, giving
-- post_payment_settlement's existing, unchanged behavior a real debit
-- counterpart for the first time.
--
-- Both new source_type values this migration posts under — 'invoice_issued'
-- and 'invoice_voided' — were ALREADY present in journal_entries_source_
-- type_check (added by 20260804100500_finance_reverse_journal_entry.sql,
-- alongside 'reversal'), confirming the original schema author reserved
-- them for exactly this feature. No CHECK-constraint widening is needed.
--
-- Every account referenced (1100 Accounts Receivable, 4000 Service Revenue,
-- 4900 Sales Discounts, 2100 Sales Tax Payable) was already seeded by
-- 20260803101000_finance_seed_chart_of_accounts.sql and, until this
-- migration, never posted to automatically. No Chart of Accounts change.
--
-- Recognition formula (F2.1A §15), balances by construction:
--   Debit  1100 Accounts Receivable  total_minor (subtotal+tax-discount)
--   Debit  4900 Sales Discounts      discount_minor, only if > 0
--   Credit 4000 Service Revenue      subtotal_minor
--   Credit 2100 Sales Tax Payable    tax_minor, only if > 0
-- Debits: total_minor + discount_minor = subtotal_minor + tax_minor.
-- Credits: subtotal_minor + tax_minor. Tax is deliberately excluded from
-- Revenue — it is a pass-through liability, not earned income.
--
-- New error code: P1119 — void rejected because the invoice has one or more
-- payments applied. Reversing revenue recognition after a partial payment
-- requires a proportional correction model (F2.1C, not yet built) — this
-- clean-case migration refuses the transition outright rather than
-- attempting an unsafe whole-entry reversal against a partially-settled
-- invoice. Added to the existing P1100-P1116 Posting Engine range (P1117
-- and P1118 were already claimed by earlier phases).
--
-- Scope discipline, matching the precedent
-- "F1.8 does not touch Revenue Recognition" guardrail test: this migration
-- does NOT implement void-after-partial-payment, post-issuance financial
-- edits, deposit-application, refund-side Revenue reduction, or historical
-- backfill — all explicitly deferred to F2.1C/D/E per F2.1A's decomposition.

-- ---------------------------------------------------------------------------
-- post_invoice_revenue_recognition — standalone posting primitive. Does NOT
-- validate the invoice's lifecycle status itself (same division of
-- responsibility as post_payment_settlement, which never re-checks payment
-- status) — the composing RPC below owns that check.
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice_revenue_recognition(
  p_invoice_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_ar_account public.chart_of_accounts;
  v_revenue_account public.chart_of_accounts;
  v_posting_key text;
  v_entry public.journal_entries;
  v_lines jsonb;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  if exists (select 1 from public.journal_entries where source_type = 'invoice_issued' and source_id = p_invoice_id::text) then
    raise exception 'Revenue has already been recognized for this invoice.' using errcode = 'P1104';
  end if;

  v_posting_key := 'invoice_issued:' || p_invoice_id;

  v_ar_account := public.finance_resolve_account(v_invoice.workspace_id, 1100);
  v_revenue_account := public.finance_resolve_account(v_invoice.workspace_id, 4000);

  v_lines := jsonb_build_array(
    jsonb_build_object('account_id', v_ar_account.id, 'debit_minor', v_invoice.total_minor, 'credit_minor', 0)
  );

  if v_invoice.discount_minor > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 4900)).id,
        'debit_minor', v_invoice.discount_minor, 'credit_minor', 0
      )
    );
  end if;

  v_lines := v_lines || jsonb_build_array(
    jsonb_build_object('account_id', v_revenue_account.id, 'debit_minor', 0, 'credit_minor', v_invoice.subtotal_minor)
  );

  if v_invoice.tax_minor > 0 then
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'account_id', (public.finance_resolve_account(v_invoice.workspace_id, 2100)).id,
        'debit_minor', 0, 'credit_minor', v_invoice.tax_minor
      )
    );
  end if;

  v_entry := public.finance_insert_journal_entry(
    v_invoice.workspace_id,
    v_invoice.issue_date,
    'invoice_issued',
    p_invoice_id::text,
    'Revenue recognized on invoice issuance: "' || v_invoice.title || '"',
    p_actor,
    null,
    v_posting_key,
    v_lines
  );

  return v_entry;
end;
$$;

comment on function public.post_invoice_revenue_recognition(uuid, text) is
  'Posts Revenue recognition for an invoice: Debit 1100 AR (total_minor) + 4900 Sales Discounts (discount_minor, if any), Credit 4000 Service Revenue (subtotal_minor) + 2100 Sales Tax Payable (tax_minor, if any). Idempotent per invoice via source_type=''invoice_issued''/source_id and posting_key invoice_issued:<invoice_id>. Does not validate invoice status — the composing issue_invoice_and_post_revenue_recognition owns that check.';

-- ---------------------------------------------------------------------------
-- issue_invoice_and_post_revenue_recognition — the atomic owning mutation,
-- same composition pattern as mark_payment_succeeded_and_post_settlement:
-- validate the transition, UPDATE status, `perform` the posting primitive —
-- all in one function with no explicit transaction boundary, so any
-- exception rolls back the whole thing including the status UPDATE.
-- ---------------------------------------------------------------------------

create or replace function public.issue_invoice_and_post_revenue_recognition(
  p_invoice_id uuid,
  p_actor text
)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'Cannot issue an invoice that is already %.', v_invoice.status using errcode = 'P1105';
  end if;

  update public.invoices
  set status = 'issued', issue_date = coalesce(issue_date, current_date), updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  perform public.post_invoice_revenue_recognition(p_invoice_id, p_actor);

  return v_invoice;
end;
$$;

comment on function public.issue_invoice_and_post_revenue_recognition(uuid, text) is
  'Atomic version of issueInvoice: validates the draft -> issued transition, updates status/issue_date, and posts Revenue recognition via post_invoice_revenue_recognition — all in one transaction. A posting failure rolls back the status update too.';

-- ---------------------------------------------------------------------------
-- post_invoice_voided_reversal — the clean-case reversal primitive. Refuses
-- outright (P1119) if the invoice has any payment applied — void-after-
-- partial-payment needs a proportional correction model this migration
-- does not implement (F2.1C). If the invoice was voided before ever being
-- issued (still draft — legal per INVOICE_TRANSITIONS), no revenue
-- recognition entry exists yet and this is a safe no-op (returns null).
-- ---------------------------------------------------------------------------

create or replace function public.post_invoice_voided_reversal(
  p_invoice_id uuid,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_original public.journal_entries;
  v_posting_key text;
  v_lines jsonb;
  v_line record;
  v_entry public.journal_entries;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  if v_invoice.paid_minor > 0 then
    raise exception 'Cannot void an invoice with payments applied. This requires a dedicated correction flow not yet available.'
      using errcode = 'P1119';
  end if;

  select * into v_original from public.journal_entries where source_type = 'invoice_issued' and source_id = p_invoice_id::text;
  if not found then
    return null;
  end if;

  if v_original.reversed_by_entry_id is not null then
    raise exception 'This invoice''s revenue recognition has already been reversed.' using errcode = 'P1109';
  end if;

  if exists (select 1 from public.journal_entries where source_type = 'invoice_voided' and source_id = p_invoice_id::text) then
    raise exception 'This invoice''s revenue recognition has already been reversed.' using errcode = 'P1104';
  end if;

  v_posting_key := 'invoice_voided:' || p_invoice_id;

  v_lines := '[]'::jsonb;
  for v_line in select * from public.journal_lines where journal_entry_id = v_original.id order by line_order
  loop
    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object('account_id', v_line.account_id, 'debit_minor', v_line.credit_minor, 'credit_minor', v_line.debit_minor)
    );
  end loop;

  v_entry := public.finance_insert_journal_entry(
    v_invoice.workspace_id,
    current_date,
    'invoice_voided',
    p_invoice_id::text,
    'Revenue recognition reversed: invoice voided ("' || v_invoice.title || '")',
    p_actor,
    v_original.id,
    v_posting_key,
    v_lines
  );

  update public.journal_entries set reversed_by_entry_id = v_entry.id where id = v_original.id;

  return v_entry;
end;
$$;

comment on function public.post_invoice_voided_reversal(uuid, text) is
  'Reverses an invoice''s Revenue-recognition entry when it is voided before any payment. Refuses (P1119) if paid_minor > 0 — void-after-partial-payment is out of scope for this migration. Returns null (no-op) if the invoice was never issued. Swaps every original line''s debit/credit, matching reverse_journal_entry''s own guarantee; the original entry is never mutated except reversed_by_entry_id.';

-- ---------------------------------------------------------------------------
-- void_invoice_and_reverse_revenue_recognition — the atomic owning mutation
-- for the void path, same composition pattern as above: validate, UPDATE
-- status, `perform` the reversal primitive, all in one transaction.
-- ---------------------------------------------------------------------------

create or replace function public.void_invoice_and_reverse_revenue_recognition(
  p_invoice_id uuid,
  p_actor text
)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
begin
  select * into v_invoice from public.invoices where id = p_invoice_id for update;
  if not found then
    raise exception 'Invoice not found.' using errcode = 'P1111';
  end if;

  if v_invoice.status not in ('draft', 'issued', 'sent', 'viewed', 'partially_paid', 'overdue') then
    raise exception 'Cannot void an invoice that is already %.', v_invoice.status using errcode = 'P1105';
  end if;

  update public.invoices
  set status = 'voided', voided_at = now(), updated_at = now()
  where id = p_invoice_id
  returning * into v_invoice;

  perform public.post_invoice_voided_reversal(p_invoice_id, p_actor);

  return v_invoice;
end;
$$;

comment on function public.void_invoice_and_reverse_revenue_recognition(uuid, text) is
  'Atomic version of voidInvoice: validates the transition, updates status/voided_at, and reverses Revenue recognition via post_invoice_voided_reversal (a no-op if none was ever posted) — all in one transaction. Rejects (via post_invoice_voided_reversal''s own P1119 check) voiding an invoice with payments applied.';
