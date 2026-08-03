-- Finance Database migration 8 of 11: posting-invariant triggers.
--
-- These are constraint-enforcement functions, not business-logic RPCs —
-- no post_purchase_receipt/post_payment_settlement/reverse_journal_entry/
-- close_period/lock_period exists yet (Posting Engine phase, out of scope
-- here per this phase's explicit instructions). Every function below exists
-- solely to make an invalid database state impossible, regardless of which
-- future code path performs the insert/update.
--
-- Error codes P1000-P1008 are a fresh range for this migration set — every
-- prior custom errcode in this schema (P0001-P0125, scoped per-module) is
-- already in use elsewhere, so Finance's constraint triggers get their own
-- unused block rather than colliding with Inventory's/Purchases' P0001-P0009.
--
--   P1000 — journal entry is not balanced (sum debits <> sum credits)
--   P1001 — attempted DELETE on journal_entries (append-only)
--   P1002 — attempted UPDATE on journal_entries touching a non-permitted column
--   P1003 — attempted UPDATE or DELETE on journal_lines (fully append-only)
--   P1004 — attempted insert into a locked accounting period
--   P1005 — attempted insert of a non-reversal entry into a closed period
--   P1006 — reversed_by_entry_id does not point at a mutually-consistent reversal
--   P1007 — reverses_entry_id references a non-existent journal entry
--   P1008 — journal_lines.workspace_id does not match its parent entry's workspace_id
--
-- 1. Balanced journal (deferred constraint trigger)
-- ---------------------------------------------------------------------------
-- Balance is a property of the *set* of lines belonging to one entry, not
-- any single row — a plain CHECK constraint cannot express this. A deferred
-- constraint trigger fires once at the end of the transaction (after every
-- INSERT/UPDATE/DELETE on journal_lines for that statement has happened),
-- summing the affected entry's lines and raising if they don't balance —
-- rolling back the whole transaction, including whatever domain mutation
-- triggered the posting.

create or replace function public.finance_check_journal_entry_balanced()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_entry_id uuid;
  v_total_debit integer;
  v_total_credit integer;
begin
  v_entry_id := coalesce(new.journal_entry_id, old.journal_entry_id);

  select coalesce(sum(debit_minor), 0), coalesce(sum(credit_minor), 0)
  into v_total_debit, v_total_credit
  from public.journal_lines
  where journal_entry_id = v_entry_id;

  if v_total_debit <> v_total_credit then
    raise exception 'Journal entry % is not balanced: total debits % do not equal total credits %.',
      v_entry_id, v_total_debit, v_total_credit using errcode = 'P1000';
  end if;

  return null;
end;
$$;

drop trigger if exists trg_journal_lines_balanced on public.journal_lines;
create constraint trigger trg_journal_lines_balanced
  after insert or update or delete on public.journal_lines
  deferrable initially deferred
  for each row execute function public.finance_check_journal_entry_balanced();

comment on function public.finance_check_journal_entry_balanced() is
  'Deferred constraint trigger: at transaction commit, asserts sum(debit_minor) = sum(credit_minor) for the affected journal_entry_id. Cannot be a plain CHECK since balance is a cross-row property.';

-- 2. Append-only journal_entries
-- ---------------------------------------------------------------------------
-- DELETE is always rejected. UPDATE is rejected unless the only columns
-- changing are posting_status, failure_reason, and reversed_by_entry_id —
-- every other column (date, source, memo, currency, posted_by, created_at)
-- is immutable once inserted.

create or replace function public.finance_prevent_journal_entries_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'journal_entries are append-only; corrections must be posted as a reversing entry.' using errcode = 'P1001';
  end if;

  if TG_OP = 'UPDATE' then
    if new.id <> old.id
      or new.workspace_id <> old.workspace_id
      or new.entry_date <> old.entry_date
      or new.accounting_period_id <> old.accounting_period_id
      or new.source_type <> old.source_type
      or coalesce(new.source_id, '') <> coalesce(old.source_id, '')
      or coalesce(new.memo, '') <> coalesce(old.memo, '')
      or new.currency <> old.currency
      or new.posted_by <> old.posted_by
      or new.created_at <> old.created_at
    then
      raise exception 'journal_entries are append-only except for posting_status/failure_reason/reversed_by_entry_id.' using errcode = 'P1002';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_journal_entries_append_only on public.journal_entries;
create trigger trg_journal_entries_append_only
  before update or delete on public.journal_entries
  for each row execute function public.finance_prevent_journal_entries_mutation();

comment on function public.finance_prevent_journal_entries_mutation() is
  'Blocks all DELETE and every UPDATE except to posting_status/failure_reason/reversed_by_entry_id.';

-- 3. Append-only journal_lines
-- ---------------------------------------------------------------------------
-- journal_lines has zero legitimate update path at all — a correction is
-- always a new entry's new lines, never an edit to an existing line.

create or replace function public.finance_prevent_journal_lines_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'journal_lines are append-only; they can never be updated or deleted.' using errcode = 'P1003';
end;
$$;

drop trigger if exists trg_journal_lines_append_only on public.journal_lines;
create trigger trg_journal_lines_append_only
  before update or delete on public.journal_lines
  for each row execute function public.finance_prevent_journal_lines_mutation();

comment on function public.finance_prevent_journal_lines_mutation() is
  'Unconditionally rejects any UPDATE or DELETE on journal_lines.';

-- 4. Closed/locked period protection
-- ---------------------------------------------------------------------------
-- A locked period rejects every new entry, no exceptions. A closed period
-- rejects a new entry unless it is itself a reversal (reverses_entry_id is
-- set) — permission-gating *which* users may post a privileged reversal
-- into a closed period is an application-layer concern (this codebase's
-- established convention: RLS/permissions live in core/permissions, not
-- embedded in DB triggers), enforced by the future reverse_journal_entry
-- RPC, not by this trigger.

create or replace function public.finance_check_period_open_for_posting()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_status text;
begin
  select status into v_status from public.accounting_periods where id = new.accounting_period_id;

  if v_status = 'locked' then
    raise exception 'Cannot post to a locked accounting period.' using errcode = 'P1004';
  end if;

  if v_status = 'closed' and new.reverses_entry_id is null then
    raise exception 'Cannot post a new entry to a closed accounting period; only a reversal of an existing entry may be posted here.' using errcode = 'P1005';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_entries_period_protection on public.journal_entries;
create trigger trg_journal_entries_period_protection
  before insert on public.journal_entries
  for each row execute function public.finance_check_period_open_for_posting();

comment on function public.finance_check_period_open_for_posting() is
  'Rejects any new journal_entries row targeting a locked period, and any non-reversal row targeting a closed period.';

-- 5. Reversal integrity
-- ---------------------------------------------------------------------------
-- Keeps reversed_by_entry_id (on the original) and reverses_entry_id (on the
-- reversal) mutually consistent. Fires AFTER so the expected sequence
-- (insert the reversal with reverses_entry_id set, then update the original
-- to set reversed_by_entry_id) resolves correctly: by the time the
-- original's reversed_by_entry_id is set, the reversal row referenced
-- already exists with its own reverses_entry_id pointing back.

create or replace function public.finance_check_reversal_integrity()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.reversed_by_entry_id is not null then
    if not exists (
      select 1 from public.journal_entries
      where id = new.reversed_by_entry_id and reverses_entry_id = new.id
    ) then
      raise exception 'reversed_by_entry_id must point at an entry whose reverses_entry_id points back at this row.' using errcode = 'P1006';
    end if;
  end if;

  if new.reverses_entry_id is not null then
    if not exists (select 1 from public.journal_entries where id = new.reverses_entry_id) then
      raise exception 'reverses_entry_id must reference an existing journal entry.' using errcode = 'P1007';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_entries_reversal_integrity on public.journal_entries;
create trigger trg_journal_entries_reversal_integrity
  after insert or update on public.journal_entries
  for each row execute function public.finance_check_reversal_integrity();

comment on function public.finance_check_reversal_integrity() is
  'Keeps reversed_by_entry_id and reverses_entry_id mutually consistent across the original and its reversal.';

-- 6. journal_lines.workspace_id consistency with its parent entry
-- ---------------------------------------------------------------------------
-- workspace_id is denormalized onto journal_lines for RLS/query performance
-- (see migration 4's comment) and cannot be expressed as a plain FK, since
-- it must match a *specific column* on the parent row, not merely reference
-- its primary key.

create or replace function public.finance_check_journal_line_workspace_consistency()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_parent_workspace_id uuid;
begin
  select workspace_id into v_parent_workspace_id
  from public.journal_entries
  where id = new.journal_entry_id;

  if v_parent_workspace_id is null or v_parent_workspace_id <> new.workspace_id then
    raise exception 'journal_lines.workspace_id must match its parent journal_entries.workspace_id.' using errcode = 'P1008';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_journal_lines_workspace_consistency on public.journal_lines;
create trigger trg_journal_lines_workspace_consistency
  before insert on public.journal_lines
  for each row execute function public.finance_check_journal_line_workspace_consistency();

comment on function public.finance_check_journal_line_workspace_consistency() is
  'Rejects a journal_lines insert whose workspace_id does not match its parent journal_entries.workspace_id.';
