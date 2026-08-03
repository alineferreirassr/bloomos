-- Services migration 19: SQL-side equivalents of
-- core/workflows/eventServiceWorkflow.ts's resolveOffsetDueDate/
-- resolveOffsetTime — the same "TypeScript workflow is the source of
-- truth, SQL is its equivalent" rule getInventoryMovementDelta/
-- derivePurchaseReceiptStatus already established. Both are pure SQL
-- functions (immutable, no table access), used only by the
-- assign_service_to_event RPC in the next migration.

create or replace function public.resolve_offset_due_date(p_event_date date, p_offset_days integer)
returns date
language sql
immutable
as $$
  select case when p_event_date is null or p_offset_days is null then null else p_event_date - p_offset_days end;
$$;

comment on function public.resolve_offset_due_date(date, integer) is
  'SQL equivalent of resolveOffsetDueDate (core/workflows/eventServiceWorkflow.ts) — due_offset_days counts days BEFORE the Event date.';

create or replace function public.resolve_offset_time(p_base_time text, p_offset_minutes integer)
returns text
language plpgsql
immutable
as $$
declare
  v_match text[];
  v_hours integer;
  v_minutes integer;
  v_base_minutes integer;
  v_total_minutes integer;
begin
  if p_base_time is null then
    return null;
  end if;

  v_match := regexp_match(btrim(p_base_time), '^(\d{1,2}):(\d{2})$');
  if v_match is null then
    return null;
  end if;

  v_hours := v_match[1]::integer;
  v_minutes := v_match[2]::integer;
  if v_hours > 23 or v_minutes > 59 then
    return null;
  end if;

  v_base_minutes := v_hours * 60 + v_minutes;
  v_total_minutes := ((v_base_minutes + p_offset_minutes) % 1440 + 1440) % 1440;

  return lpad((v_total_minutes / 60)::text, 2, '0') || ':' || lpad((v_total_minutes % 60)::text, 2, '0');
end;
$$;

comment on function public.resolve_offset_time(text, integer) is
  'SQL equivalent of resolveOffsetTime (core/workflows/eventServiceWorkflow.ts) — tolerates a malformed/absent base time by returning null rather than raising, matching the TypeScript function exactly.';
