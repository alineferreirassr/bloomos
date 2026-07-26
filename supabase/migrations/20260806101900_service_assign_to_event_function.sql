-- Services migration 20: atomic assign_service_to_event RPC.
--
-- Resolves docs/services.md's "Locked domain decisions" #4 and #5: the
-- entire operation — the event_services row, both real checklist_items/
-- event_schedule_items inserts, and all five requirement/assignment
-- child-table inserts — happens in one transaction, and this is the only
-- way the Supabase repository is permitted to perform an assignment (never
-- client-composed multi-query).
--
-- Mirrors lib/data/services/mockRepository.ts's assignServiceToEvent and
-- core/workflows/eventServiceWorkflow.ts's buildEventServiceAssignmentPlan/
-- computeServicePrice/computeServiceRequirements exactly — this function IS
-- their SQL-side equivalent, not a second, divergent implementation of the
-- same business rules.
--
-- Row-locks the target events row before computing existing checklist/
-- schedule counts (for sort_order), serializing concurrent assignments to
-- the same Event so their generated items never collide on sort_order.
--
-- selected_add_on_ids is a uuid[] — the caller passes exactly what
-- AssignServiceToEventInput.selected_add_on_ids already validates
-- (assignServiceToEventInputSchema).
--
-- Error codes (scoped to this function):
--   P0030 — Event not found
--   P0031 — Service not found
--   P0032 — Service has no published version and cannot be assigned yet
--   P0033 — published version not found (defensive only)

create or replace function public.assign_service_to_event(
  p_event_id uuid,
  p_service_id uuid,
  p_selected_add_on_ids uuid[],
  p_actor text
)
returns public.event_services
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_event public.events;
  v_service public.services;
  v_version public.service_versions;
  v_price_minor integer;
  v_name text;
  v_event_service public.event_services;
  v_existing_checklist_count integer;
  v_existing_schedule_count integer;
  v_index integer;
  v_checklist_item record;
  v_timeline_item record;
  v_due_date date;
  v_start_time text;
  v_end_time text;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found then
    raise exception 'Event not found.' using errcode = 'P0030';
  end if;

  select * into v_service from public.services where id = p_service_id;
  if not found then
    raise exception 'Service not found.' using errcode = 'P0031';
  end if;

  if v_service.status <> 'active' or v_service.current_published_version_id is null then
    raise exception 'This Service has no published version and cannot be assigned yet.' using errcode = 'P0032';
  end if;

  select * into v_version from public.service_versions where id = v_service.current_published_version_id;
  if not found then
    raise exception 'Published version not found.' using errcode = 'P0033';
  end if;

  v_name := coalesce(v_version.name_snapshot, v_service.name);

  select v_version.base_price_minor + coalesce(sum(price_delta_minor), 0) into v_price_minor
  from public.service_addons
  where service_version_id = v_version.id and id = any (p_selected_add_on_ids);

  insert into public.event_services (
    workspace_id, event_id, service_id, service_version_id, name, name_template_value,
    price_minor, price_template_value, currency, selected_add_on_ids, status, assigned_at, assigned_by
  )
  values (
    v_service.workspace_id, p_event_id, p_service_id, v_version.id, v_name, v_name,
    v_price_minor, v_price_minor, v_version.currency, coalesce(p_selected_add_on_ids, '{}'), 'proposed', now(), p_actor
  )
  returning * into v_event_service;

  select count(*) into v_existing_checklist_count from public.checklist_items where owner_type = 'event' and owner_id = p_event_id;
  select count(*) into v_existing_schedule_count from public.event_schedule_items where owner_type = 'event' and owner_id = p_event_id;

  v_index := 0;
  for v_checklist_item in
    select * from public.service_checklist_template_items where service_version_id = v_version.id order by display_order
  loop
    v_due_date := public.resolve_offset_due_date(v_event.event_date, v_checklist_item.due_offset_days);
    insert into public.checklist_items (
      workspace_id, owner_type, owner_id, title, description, category, priority, status, due_date,
      assigned_type, sort_order, source_event_service_id, template_snapshot
    )
    values (
      v_service.workspace_id, 'event', p_event_id, v_checklist_item.title, null, v_checklist_item.category,
      v_checklist_item.priority, 'pending', v_due_date, 'unknown', v_existing_checklist_count + v_index,
      v_event_service.id,
      jsonb_build_object('title', v_checklist_item.title, 'category', v_checklist_item.category, 'priority', v_checklist_item.priority, 'due_date', v_due_date)
    );
    v_index := v_index + 1;
  end loop;

  v_index := 0;
  for v_timeline_item in
    select * from public.service_timeline_template_items where service_version_id = v_version.id order by display_order
  loop
    v_start_time := public.resolve_offset_time(v_event.start_time, v_timeline_item.offset_minutes_from_event_start);
    v_end_time := case when v_start_time is not null and v_timeline_item.duration_minutes is not null
      then public.resolve_offset_time(v_start_time, v_timeline_item.duration_minutes)
      else null end;
    insert into public.event_schedule_items (
      workspace_id, owner_type, owner_id, title, description, start_time, end_time, category, status,
      sort_order, source_event_service_id, template_snapshot
    )
    values (
      v_service.workspace_id, 'event', p_event_id, v_timeline_item.title, null, v_start_time, v_end_time,
      v_timeline_item.category, 'planned', v_existing_schedule_count + v_index, v_event_service.id,
      jsonb_build_object('title', v_timeline_item.title, 'category', v_timeline_item.category, 'start_time', v_start_time, 'end_time', v_end_time)
    );
    v_index := v_index + 1;
  end loop;

  insert into public.event_service_inventory_requirements (workspace_id, event_service_id, inventory_item_id, item_name, quantity, is_fulfilled, note)
    select v_service.workspace_id, v_event_service.id, inventory_item_id, item_name, quantity, false, null
    from public.service_inventory_template_items where service_version_id = v_version.id;

  insert into public.event_service_purchase_requirements (workspace_id, event_service_id, item_name, estimated_unit_cost_minor, estimated_quantity, typical_vendor_id, fulfilled_purchase_id)
    select v_service.workspace_id, v_event_service.id, item_name, estimated_unit_cost_minor, estimated_quantity, typical_vendor_id, null
    from public.service_purchase_template_items where service_version_id = v_version.id;

  insert into public.event_service_budget_lines (workspace_id, event_service_id, label, category, estimated_revenue_minor, estimated_cost_minor)
    select v_service.workspace_id, v_event_service.id, label, category, estimated_revenue_minor, estimated_cost_minor
    from public.service_budget_template_lines where service_version_id = v_version.id;

  insert into public.event_service_team_requirements (workspace_id, event_service_id, role_label, quantity, note, assigned_member_id)
    select v_service.workspace_id, v_event_service.id, role_label, quantity, note, null
    from public.service_team_role_requirements where service_version_id = v_version.id;

  insert into public.event_service_vendor_assignments (workspace_id, event_service_id, vendor_id, status, note)
    select v_service.workspace_id, v_event_service.id, vendor_id, 'suggested', note
    from public.service_vendor_suggestions where service_version_id = v_version.id;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_service.workspace_id, 'event', p_event_id, 'event_service_assigned',
    'Service "' || v_name || '" assigned to this Event', p_actor,
    jsonb_build_object('event_service_id', v_event_service.id, 'service_id', p_service_id)
  );

  return v_event_service;
end;
$$;

comment on function public.assign_service_to_event(uuid, uuid, uuid[], text) is
  'Atomic, row-locked assignment operation: validates the Service is assignable, computes price, generates real checklist_items/event_schedule_items rows plus all five Instance-layer requirement/assignment child tables, and logs one Timeline entry — all in one transaction. See docs/services.md.';
