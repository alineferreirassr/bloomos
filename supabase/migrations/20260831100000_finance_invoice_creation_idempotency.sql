-- Finance F2.1C-F-E-D-B1: Create Invoice request idempotency.
--
-- Founder decision (F2.1C-F-E-A/E-D-A, Option B): a UI-only fix is not
-- accepted as sufficient — Create Invoice must distinguish a retry of the
-- SAME logical request from a NEW intentional invoice using explicit
-- durable request identity, the same mechanism already protecting Refund,
-- Deposit Application, Deposit Application Reversal, Manual Adjustment, and
-- Payment/Settlement.
--
-- SCOPE: this migration owns Create Invoice only. Edit Invoice
-- (updateInvoice), Issue Invoice, Void Invoice, and duplicateInvoice() are
-- untouched — none of them create an ambiguous-success create request the
-- way a lost/retried Create Invoice submission does; edits target an
-- already-known, stable id, and duplicateInvoice is a distinct, deliberate,
-- always-new-resource action, not a retry of anything.
--
-- WHY caller-supplied invoices.id (mirrors Refund/Deposit Application/
-- Payment's identity model, not Manual Adjustment's): invoices.id is
-- already `uuid primary key default gen_random_uuid()`
-- (20260721100000_invoices.sql) — an explicit value in this function's own
-- INSERT column list already overrides that default with zero schema
-- change. An Invoice has no pre-existing parent row to key request
-- identity off of, the same shape Payment/Refund/Deposit Application share.
--
-- WHY a NEW immutable creation-request snapshot column, NOT a comparison
-- against the Invoice's own current persisted columns (Manual Adjustment/
-- Payment's technique): unlike every resource this workstream has
-- previously protected, an Invoice has a real, deliberate Edit surface
-- (updateInvoice) that legitimately mutates the exact same fields
-- (title/subtotal_minor/tax_minor/discount_minor/currency/notes/etc.) a
-- replay comparison would need to check. Comparing against the CURRENT row
-- would make a stale retry of an original creation request spuriously
-- conflict (or worse, silently succeed against edited data) after a later,
-- unrelated, legitimate edit — a defect this migration avoids by never
-- comparing against live Invoice columns for replay purposes. Instead, the
-- exact payload submitted at creation is frozen once, at INSERT time, into
-- a new `creation_request_snapshot` column that no other function in this
-- schema ever writes to again — updateInvoice, issueInvoice, voidInvoice,
-- and duplicateInvoice are all untouched by this migration and none of them
-- reference this column. A replay reads this frozen snapshot, compares it
-- to the incoming request, and — on a match — returns the Invoice's
-- CURRENT state unmutated (preserving any legitimate edits since creation),
-- never re-inserting and never overwriting.
--
-- WHY a same-row jsonb column, NOT a separate operation/idempotency table:
-- since the caller-supplied id already becomes the Invoice's own primary
-- key, the replay lookup already fetches the row by that id in a single
-- query — storing the frozen snapshot as a column on that same row costs
-- zero additional queries and zero additional tables, and matches every
-- other migration in this idempotency series, none of which introduced a
-- new table.
--
-- INVOICE NUMBER: generate_invoice_number (20260721100700) is reused
-- unchanged. On a fresh (not-found) request the existing retry-on-
-- unique-violation behavior (previously orchestrated client-side across
-- two round-trips) now lives entirely inside this one atomic function,
-- retrying ONLY the invoice_number — the caller-supplied id never changes
-- across attempts. A replay never generates a new number; it returns the
-- exact invoice_number the original request received.
--
-- CONCURRENCY: like every prior resource in this series with no natural
-- parent row to lock, invoices.id's own PRIMARY KEY constraint remains the
-- absolute backstop: two concurrent requests sharing the exact same
-- p_invoice_id can never both commit a row. No exception handler exists for
-- an id (PK) collision — only for invoices_workspace_number_unique
-- specifically, and only on the fresh-insert path — so the losing
-- transaction in that one narrow, vanishingly rare race surfaces a raw
-- Postgres primary-key-violation error rather than the friendly P1129
-- message, exactly the same accepted cosmetic nuance already documented for
-- Refund, Deposit Application, and Payment/Settlement: no resource or
-- financial duplication is possible either way, and a subsequent retry with
-- the same id finds the now-committed row via the same replay lookup.
--
-- ACCOUNTING: createInvoice posts no Journal Entry today (confirmed fresh
-- from source in F2.1C-F-E-D-A) and this migration introduces none —
-- Revenue recognition remains exclusively issueInvoice's responsibility,
-- untouched here.
--
-- ERROR CODES: reuses the existing, already-registered P1129 (idempotency
-- key reused for a different payload) / P1130 (required key missing) pair
-- verbatim, with Invoice-specific message text — both are already members
-- of the single shared FINANCE_VALIDATION_ERROR_CODES set the TypeScript
-- repository layer uses, so no error-registry change is needed anywhere.
--
-- Scope boundary: does not touch RLS or policies (the new function is
-- `security invoker`, so the existing invoices_insert_workspace_member
-- policy governs its INSERT exactly as it does every other Invoice insert
-- today). Does not widen any CHECK constraint. Does not touch
-- invoices_workspace_number_unique. Does not redefine generate_invoice_number,
-- recompute_invoice_balance, or any other function. Does not edit any
-- already-pushed migration. No historical backfill — existing Invoice rows
-- simply carry a NULL creation_request_snapshot; they predate this
-- mechanism and can never be the target of a replay lookup under a caller-
-- generated id no pre-existing row could ever match. Does not touch
-- Expense, Payment, or Settlement in any way.

alter table public.invoices add column if not exists creation_request_snapshot jsonb;

comment on column public.invoices.creation_request_snapshot is
  'Finance F2.1C-F-E-D-B1: immutable, write-once-at-creation snapshot of the exact request payload record_invoice_creation received for this row — used only to distinguish a safe replay from a genuine payload conflict on a repeated p_invoice_id. NULL for every Invoice created before this migration, and for every Invoice created via duplicateInvoice() (a distinct, always-new-resource action, never a retry). Never written to by updateInvoice, issueInvoice, voidInvoice, or duplicateInvoice — this column is internal idempotency metadata, never a user-facing or caller-supplied Invoice field.';

create or replace function public.record_invoice_creation(
  p_workspace_id uuid,
  p_client_id uuid,
  p_event_id uuid,
  p_contract_id uuid,
  p_title text,
  p_description text,
  p_issue_date date,
  p_due_date date,
  p_subtotal_minor integer,
  p_tax_minor integer,
  p_discount_minor integer,
  p_currency text,
  p_notes text,
  p_invoice_id uuid
)
returns public.invoices
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_invoice public.invoices;
  v_existing public.invoices;
  v_snapshot jsonb;
  v_total_minor integer;
  v_invoice_number text;
  v_attempt integer := 0;
  v_constraint_name text;
begin
  if p_invoice_id is null then
    raise exception 'p_invoice_id is required and must be a stable identifier supplied by the caller (the same value on every retry of the same invoice creation request).'
      using errcode = 'P1130';
  end if;

  -- Request-level idempotency: checked immediately after the null-id
  -- guard, before any other validation (which could spuriously fail
  -- against CURRENT state on a replay) — same convention as every other
  -- Finance idempotency-key check in this migration set. Scoped to the
  -- calling workspace so a replay can never read or return an invoice
  -- belonging to a different workspace.
  select * into v_existing from public.invoices where id = p_invoice_id and workspace_id = p_workspace_id;

  if found then
    -- A historical Invoice (created before this migration, or via
    -- duplicateInvoice) has a NULL snapshot — it must never be treated as a
    -- confirmed replay. Fail safely as a conflict rather than silently
    -- returning someone else's row as if it were this request's own result.
    if v_existing.creation_request_snapshot is null
      or (v_existing.creation_request_snapshot->>'client_id')::uuid is distinct from p_client_id
      or (v_existing.creation_request_snapshot->>'event_id')::uuid is distinct from p_event_id
      or (v_existing.creation_request_snapshot->>'contract_id')::uuid is distinct from p_contract_id
      or (v_existing.creation_request_snapshot->>'title') is distinct from p_title
      or (v_existing.creation_request_snapshot->>'description') is distinct from p_description
      or (v_existing.creation_request_snapshot->>'issue_date')::date is distinct from p_issue_date
      or (v_existing.creation_request_snapshot->>'due_date')::date is distinct from p_due_date
      or (v_existing.creation_request_snapshot->>'subtotal_minor')::integer is distinct from p_subtotal_minor
      or (v_existing.creation_request_snapshot->>'tax_minor')::integer is distinct from p_tax_minor
      or (v_existing.creation_request_snapshot->>'discount_minor')::integer is distinct from p_discount_minor
      or (v_existing.creation_request_snapshot->>'currency') is distinct from p_currency
      or (v_existing.creation_request_snapshot->>'notes') is distinct from p_notes
    then
      raise exception 'This idempotency key was already used for a different invoice creation request.' using errcode = 'P1129';
    end if;
    -- Safe replay: return the Invoice's CURRENT state untouched — any
    -- legitimate edit made since the original creation is preserved, never
    -- overwritten by this stale request's original payload.
    return v_existing;
  end if;

  v_total_minor := p_subtotal_minor + p_tax_minor - p_discount_minor;

  v_snapshot := jsonb_build_object(
    'client_id', p_client_id,
    'event_id', p_event_id,
    'contract_id', p_contract_id,
    'title', p_title,
    'description', p_description,
    'issue_date', p_issue_date,
    'due_date', p_due_date,
    'subtotal_minor', p_subtotal_minor,
    'tax_minor', p_tax_minor,
    'discount_minor', p_discount_minor,
    'currency', p_currency,
    'notes', p_notes
  );

  loop
    v_attempt := v_attempt + 1;
    v_invoice_number := public.generate_invoice_number(p_workspace_id);

    begin
      insert into public.invoices (
        id, workspace_id, client_id, event_id, contract_id, invoice_number,
        title, description, status, issue_date, due_date,
        subtotal_minor, tax_minor, discount_minor, total_minor,
        paid_minor, balance_minor, currency, notes, creation_request_snapshot
      ) values (
        p_invoice_id, p_workspace_id, p_client_id, p_event_id, p_contract_id, v_invoice_number,
        p_title, p_description, 'draft', p_issue_date, p_due_date,
        p_subtotal_minor, p_tax_minor, p_discount_minor, v_total_minor,
        0, v_total_minor, p_currency, p_notes, v_snapshot
      )
      returning * into v_invoice;
      exit;
    exception when unique_violation then
      -- Only a genuine invoice_number collision is worth retrying (with a
      -- freshly generated number, same MAX_INVOICE_NUMBER_ATTEMPTS=5 ceiling
      -- the prior client-orchestrated retry loop used) — the caller-supplied
      -- p_invoice_id itself is NEVER rotated on retry. Any other
      -- unique-violation (in particular the invoices primary key, in the
      -- vanishingly rare true concurrent-same-id race) re-raises immediately
      -- as a raw error, matching this migration set's own established "no
      -- exception handler for the id-PK-collision path" convention.
      get stacked diagnostics v_constraint_name = constraint_name;
      if v_constraint_name = 'invoices_workspace_number_unique' and v_attempt < 5 then
        continue;
      end if;
      raise;
    end;
  end loop;

  return v_invoice;
end;
$$;

comment on function public.record_invoice_creation(uuid, uuid, uuid, uuid, text, text, date, date, integer, integer, integer, text, text, uuid) is
  'Inserts a new draft Invoice using the caller-supplied p_invoice_id directly as its primary key, generating its invoice_number the same way generate_invoice_number/the unique index already guarantee (retrying only the number, never the id, on a collision). Posts no accounting — Revenue recognition remains issueInvoice''s exclusive responsibility. Finance F2.1C-F-E-D-B1: p_invoice_id is a REQUIRED (P1130 if null) request-level idempotency key. A repeat call with the same key and the same client_id/event_id/contract_id/title/description/issue_date/due_date/subtotal_minor/tax_minor/discount_minor/currency/notes payload (compared against an immutable snapshot frozen at creation, never the row''s current editable columns) replays the original Invoice with no re-mutation, preserving any legitimate edit made since; a repeat with a different payload is rejected (P1129). A different key with an identical payload always creates a new, independent, legitimate Invoice.';
