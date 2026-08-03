-- Finance Posting Engine migration 9 of 9: create_accounting_period,
-- close_period, lock_period.
--
-- create_accounting_period does not auto-create periods for every
-- workspace — it creates exactly one period, for the workspace_id and date
-- range the caller supplies. The previously documented new-workspace Chart
-- of Accounts provisioning gap is unrelated and is explicitly NOT fixed
-- here, matching the brief.
--
-- Overlap is pre-checked with an explicit SELECT (raising a clear P1116)
-- rather than relying solely on catching the accounting_periods_no_overlap
-- EXCLUDE constraint's raw exclusion_violation, keeping this migration set
-- free of exception handlers throughout (matching the established
-- convention already asserted by this schema's own migration tests). The
-- EXCLUDE constraint remains the ultimate, concurrency-safe backstop for
-- the rare case of two concurrent creates racing past the pre-check.
--
-- close_period/lock_period are concurrency-safe via a row lock on the
-- target period: two concurrent close (or lock) attempts serialize on that
-- lock, and the second call's status check — evaluated after acquiring the
-- lock, once the first call's transaction has committed — correctly
-- rejects a second attempt rather than racing past it.

create or replace function public.create_accounting_period(
  p_workspace_id uuid,
  p_period_start date,
  p_period_end date,
  p_actor text
)
returns public.accounting_periods
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period public.accounting_periods;
begin
  if p_period_end <= p_period_start then
    raise exception 'period_end must be after period_start.' using errcode = 'P1116';
  end if;

  if exists (
    select 1 from public.accounting_periods
    where workspace_id = p_workspace_id
      and daterange(period_start, period_end, '[]') && daterange(p_period_start, p_period_end, '[]')
  ) then
    raise exception 'This date range overlaps an existing accounting period for this workspace.' using errcode = 'P1116';
  end if;

  insert into public.accounting_periods (workspace_id, period_start, period_end)
  values (p_workspace_id, p_period_start, p_period_end)
  returning * into v_period;

  return v_period;
end;
$$;

comment on function public.create_accounting_period(uuid, date, date, text) is
  'Creates one open accounting period for the given workspace and date range. Rejects an invalid or overlapping range with a clear error (P1116) before insert; the accounting_periods_no_overlap EXCLUDE constraint remains the concurrency-safe backstop. Does not auto-create periods for other workspaces.';

create or replace function public.close_period(
  p_period_id uuid,
  p_actor text
)
returns public.accounting_periods
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period public.accounting_periods;
begin
  select * into v_period from public.accounting_periods where id = p_period_id for update;
  if not found then
    raise exception 'Accounting period not found.' using errcode = 'P1111';
  end if;

  if v_period.status <> 'open' then
    raise exception 'Cannot close a period with status %.', v_period.status using errcode = 'P1105';
  end if;

  if exists (
    select 1 from public.journal_entries
    where accounting_period_id = p_period_id and posting_status in ('pending', 'failed')
  ) then
    raise exception 'Cannot close a period with unresolved pending or failed postings.' using errcode = 'P1105';
  end if;

  update public.accounting_periods
  set status = 'closed', closed_at = now(), closed_by = p_actor, updated_at = now()
  where id = p_period_id
  returning * into v_period;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (
    v_period.workspace_id, 'accounting_period', v_period.id, 'accounting_period_closed',
    'Accounting period closed: ' || v_period.period_start || ' to ' || v_period.period_end, p_actor
  );

  return v_period;
end;
$$;

comment on function public.close_period(uuid, text) is
  'Transitions an accounting period from open to closed. Rejects if not currently open, or if unresolved pending/failed postings exist for the period. Logs one accounting_period_closed Timeline entry. Concurrency-safe via a row lock on the period.';

create or replace function public.lock_period(
  p_period_id uuid,
  p_actor text
)
returns public.accounting_periods
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_period public.accounting_periods;
begin
  select * into v_period from public.accounting_periods where id = p_period_id for update;
  if not found then
    raise exception 'Accounting period not found.' using errcode = 'P1111';
  end if;

  if v_period.status <> 'closed' then
    raise exception 'Cannot lock a period with status % — a period must be closed before it can be locked.', v_period.status
      using errcode = 'P1105';
  end if;

  update public.accounting_periods
  set status = 'locked', locked_at = now(), locked_by = p_actor, updated_at = now()
  where id = p_period_id
  returning * into v_period;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (
    v_period.workspace_id, 'accounting_period', v_period.id, 'accounting_period_locked',
    'Accounting period locked: ' || v_period.period_start || ' to ' || v_period.period_end, p_actor
  );

  return v_period;
end;
$$;

comment on function public.lock_period(uuid, text) is
  'Transitions an accounting period from closed to locked. Rejects a direct open-to-locked transition and an already-locked period. Logs one accounting_period_locked Timeline entry. Concurrency-safe via a row lock on the period.';
