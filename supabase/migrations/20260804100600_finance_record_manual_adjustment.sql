-- Finance Posting Engine migration 7 of 9: record_manual_adjustment.
--
-- The one flow where a human directly authors a Journal Entry rather than
-- a domain RPC deriving one automatically. p_lines is a jsonb array of
-- {"account_id": uuid, "debit_minor": integer, "credit_minor": integer,
-- "line_memo": text (optional)} objects — unlike the system-posting RPCs
-- (which resolve accounts by workspace_id + account_number via
-- finance_resolve_account), a manual adjustment's caller supplies real
-- account_id values directly, since a human is picking from the full Chart
-- of Accounts, not just the seeded system accounts. Every line's account is
-- explicitly validated to belong to the given workspace and not be
-- archived — "all accounts must be active and postable" is satisfied via
-- archived_at is null (no is_postable column exists in this schema).
--
-- Balance is pre-validated here (raising the clear P1106 before any insert
-- is attempted) in addition to the deferred constraint trigger from the
-- Database Schema phase, which remains the ultimate backstop regardless of
-- which code path performs the insert. No automatic balancing or plug line
-- is ever added — an unbalanced adjustment is rejected outright.
--
-- source_id is always null (source_type = 'manual_adjustment' is the one
-- value the source_consistency CHECK requires this for) — there is no
-- domain source document for a manual entry.
--
-- posting_key is likewise always null here (correction, pre-checkpoint):
-- each Manual Adjustment is a deliberate, distinct human action with no
-- natural one-time-per-source identity to derive a deterministic key from
-- — unlike a Purchase Receipt, Payment, Expense transition, Inventory
-- movement, or Reversal, none of which apply here. There is nothing to
-- protect against replaying, since there is no "source event" a retry
-- could be a retry of.

create or replace function public.record_manual_adjustment(
  p_workspace_id uuid,
  p_entry_date date,
  p_memo text,
  p_lines jsonb,
  p_actor text
)
returns public.journal_entries
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_line_count integer := 0;
  v_total_debit integer := 0;
  v_total_credit integer := 0;
  v_debit integer;
  v_credit integer;
  v_account_id uuid;
  v_account public.chart_of_accounts;
  v_entry public.journal_entries;
begin
  if p_memo is null or btrim(p_memo) = '' then
    raise exception 'A memo is required for a manual adjustment.' using errcode = 'P1113';
  end if;

  if p_lines is null or jsonb_array_length(p_lines) < 2 then
    raise exception 'A manual adjustment requires at least two lines.' using errcode = 'P1114';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    v_line_count := v_line_count + 1;
    v_debit := coalesce((v_line->>'debit_minor')::integer, 0);
    v_credit := coalesce((v_line->>'credit_minor')::integer, 0);
    v_account_id := (v_line->>'account_id')::uuid;

    if (v_debit > 0 and v_credit > 0) or (v_debit = 0 and v_credit = 0) then
      raise exception 'Line % must have exactly one of debit_minor or credit_minor positive.', v_line_count
        using errcode = 'P1115';
    end if;

    select * into v_account from public.chart_of_accounts where id = v_account_id;
    if not found then
      raise exception 'Line % references an account that does not exist.', v_line_count using errcode = 'P1111';
    end if;

    if v_account.workspace_id <> p_workspace_id then
      raise exception 'Line % references an account from a different workspace.', v_line_count using errcode = 'P1107';
    end if;

    if v_account.archived_at is not null then
      raise exception 'Line % references archived account "%".', v_line_count, v_account.name using errcode = 'P1108';
    end if;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  end loop;

  if v_total_debit <> v_total_credit then
    raise exception 'Manual adjustment is not balanced: total debits % do not equal total credits %.',
      v_total_debit, v_total_credit using errcode = 'P1106';
  end if;

  v_entry := public.finance_insert_journal_entry(
    p_workspace_id, p_entry_date, 'manual_adjustment', null, p_memo, p_actor, null, null, p_lines
  );

  return v_entry;
end;
$$;

comment on function public.record_manual_adjustment(uuid, date, text, jsonb, text) is
  'Creates a balanced manual Journal Entry from caller-supplied lines (real account_id values, not resolved by number). Requires a nonblank memo, at least 2 lines, exactly one nonzero side per line, matching total debits/credits, and every account to belong to the given workspace and not be archived. Never auto-balances or adds a plug line.';
