-- Events migration 8 of 8: atomic default-checklist-application helper
-- function.
--
-- public.apply_default_event_checklist(uuid, jsonb, text, text) — the
-- Supabase equivalent of the mock's applyDefaultChecklistTemplate(): inserts
-- every template item AND records exactly one summarized
-- checklist_template_applied timeline entry as a single atomic operation, so
-- a fresh Event's checklist is never left half-populated. Called via
-- supabase.rpc(...) from lib/data/events/supabaseRepository.ts, only when
-- DEFAULT_CHECKLIST_TEMPLATES has an entry for the new Event's event_type —
-- exactly like the mock's createEvent().
--
-- `security invoker` (the default), same rationale as
-- convert_lead_to_client: every insert here is still checked against the
-- caller's own checklist_items/timeline_activities RLS policies, no
-- service-role needed. Item validation (checklistItemSchema) happens in
-- TypeScript before this function is ever called — the mock validates every
-- template item first and writes nothing if any fails, and the Supabase
-- repository mirrors that by validating client-side and simply not calling
-- this function at all on a validation failure, rather than re-validating
-- inside SQL.
--
-- p_description is passed in pre-formatted (e.g. "Default Proposal checklist
-- created with 11 items.") rather than built here, keeping all
-- human-readable formatting in one place (TypeScript), matching how every
-- other insertTimelineActivity call in this codebase already works.

create or replace function public.apply_default_event_checklist(
  p_event_id uuid,
  p_items jsonb,
  p_description text,
  p_actor text
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.events%rowtype;
  v_item jsonb;
  v_inserted public.checklist_items%rowtype;
  v_new_items jsonb := '[]'::jsonb;
  v_count integer := 0;
begin
  select * into v_event from public.events where id = p_event_id;

  if not found then
    raise exception 'Event not found.' using errcode = 'P0001';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.checklist_items (
      workspace_id, owner_type, owner_id, title, description, category, priority,
      status, due_date, assigned_type, assigned_id, assigned_name, sort_order
    ) values (
      v_event.workspace_id, 'event', v_event.id,
      v_item ->> 'title', v_item ->> 'description', v_item ->> 'category', v_item ->> 'priority',
      'pending', nullif(v_item ->> 'due_date', '')::date, v_item ->> 'assigned_type',
      nullif(v_item ->> 'assigned_id', '')::uuid, v_item ->> 'assigned_name', v_count
    )
    returning * into v_inserted;

    v_new_items := v_new_items || to_jsonb(v_inserted);
    v_count := v_count + 1;
  end loop;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (v_event.workspace_id, 'event', v_event.id, 'checklist_template_applied', p_description, p_actor);

  return v_new_items;
end;
$$;

comment on function public.apply_default_event_checklist(uuid, jsonb, text, text) is
  'Atomically inserts a default checklist template''s items and records one summarized checklist_template_applied timeline entry. security invoker so RLS on checklist_items/timeline_activities still applies to the calling user.';

revoke all on function public.apply_default_event_checklist(uuid, jsonb, text, text) from public;
grant execute on function public.apply_default_event_checklist(uuid, jsonb, text, text) to authenticated;
