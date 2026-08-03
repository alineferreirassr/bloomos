-- Contracts migration 8 of 8: generate_contract_number() helper function.
--
-- Database-safe replacement for the mock's generateContractNumber(): same
-- algorithm (current UTC year, workspace-scoped sequence, CT-{year}-{4-digit}
-- format, loop past any collision), computed server-side against live data
-- instead of an in-memory array. `security invoker` (not `security
-- definer`) — same rationale as convert_lead_to_client/
-- apply_default_event_checklist: the SELECT inside is still governed by the
-- caller's own `contracts` RLS policy, no service_role needed.
--
-- This function only *proposes* a candidate — the durable guarantee against
-- duplicates is the workspace-scoped unique index from migration 6
-- (contracts_workspace_number_unique). A caller that loses a race (two
-- concurrent requests both call this function before either inserts) gets a
-- unique-violation (23505) on insert, not a silently duplicated number; the
-- Supabase repository retries generation+insert on that specific error.
-- This is the same "propose, then let a DB constraint be the real
-- backstop" shape as every other collision-prone generator in this
-- codebase, just made durable across concurrent connections instead of a
-- single in-memory array.

create or replace function public.generate_contract_number(p_workspace_id uuid)
returns text
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_year text := to_char(now() at time zone 'utc', 'YYYY');
  v_sequence integer;
  v_candidate text;
begin
  select count(*) + 1 into v_sequence
  from public.contracts
  where workspace_id = p_workspace_id;

  v_candidate := 'CT-' || v_year || '-' || lpad(v_sequence::text, 4, '0');

  while exists (
    select 1 from public.contracts
    where workspace_id = p_workspace_id and contract_number = v_candidate
  ) loop
    v_sequence := v_sequence + 1;
    v_candidate := 'CT-' || v_year || '-' || lpad(v_sequence::text, 4, '0');
  end loop;

  return v_candidate;
end;
$$;

comment on function public.generate_contract_number(uuid) is
  'Proposes the next workspace-scoped CT-{year}-{seq} contract number. The unique index contracts_workspace_number_unique (migration 6) is the actual collision guarantee; callers retry on a 23505 unique-violation.';
