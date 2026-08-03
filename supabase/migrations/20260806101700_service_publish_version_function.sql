-- Services migration 18: atomic publish_service_version RPC.
--
-- Resolves docs/services.md's "Locked domain decisions" #2 (versioning
-- concurrency): row-locks the parent services row (`for update`) before
-- computing the next version_number, so two concurrent publish calls for
-- the same Service serialize on that lock rather than racing — the second
-- call simply waits, then computes its number from the now-committed
-- state of the first. The unique partial index from
-- 20260806100200_service_versions.sql is the backstop if that ever failed.
--
-- Mirrors buildEventServiceAssignmentPlan's TypeScript logic in
-- lib/data/services/mockRepository.ts's publishServiceVersion exactly: (1)
-- freeze the current draft (stamp version_number/published_at/published_by,
-- copy name_snapshot/description_snapshot from services.name/description at
-- this exact moment), (2) insert a brand new draft row, (3) deep-copy every
-- one of the 16 template tables' rows from the old draft into the new one,
-- (4) repoint services.draft_version_id/current_published_version_id.
--
-- Disclosed limitation: individual template-row CRUD (create/update/remove
-- on any of the 16 tables) is not itself routed through an RPC in this
-- phase — a plain client insert/update against a template table has no
-- lock on the parent services/service_versions row. In the extremely
-- narrow window where such a write is mid-flight (already past its own
-- immutability-trigger check) at the exact moment this function's SELECT
-- INTO clone step runs, it could be missed from the clone. This is
-- disclosed rather than solved with pessimistic locking on every template
-- table's plain CRUD path, which would be a larger design change than
-- scoped here — worth revisiting if the Supabase Repository phase moves
-- template CRUD behind RPCs of its own.
--
-- Error codes (scoped to this function):
--   P0021 — Service not found
--   P0022 — draft version not found (should never happen given the
--           invariants; defensive only)
--   P0023 — the draft is somehow not in "draft" status (defensive only)

create or replace function public.publish_service_version(
  p_service_id uuid,
  p_change_summary text,
  p_actor text
)
returns public.service_versions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_service public.services;
  v_draft public.service_versions;
  v_new_draft_id uuid;
  v_version_number integer;
  v_published public.service_versions;
begin
  select * into v_service from public.services where id = p_service_id for update;
  if not found then
    raise exception 'Service not found.' using errcode = 'P0021';
  end if;

  if v_service.draft_version_id is null then
    raise exception 'Draft version not found.' using errcode = 'P0022';
  end if;

  select * into v_draft from public.service_versions where id = v_service.draft_version_id for update;
  if not found then
    raise exception 'Draft version not found.' using errcode = 'P0022';
  end if;

  if v_draft.status <> 'draft' then
    raise exception 'This version is not currently a draft.' using errcode = 'P0023';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_version_number
  from public.service_versions
  where service_id = p_service_id;

  update public.service_versions
  set status = 'published',
      version_number = v_version_number,
      name_snapshot = v_service.name,
      description_snapshot = v_service.description,
      change_summary = p_change_summary,
      published_at = now(),
      published_by = p_actor,
      updated_at = now()
  where id = v_draft.id
  returning * into v_published;

  v_new_draft_id := gen_random_uuid();
  insert into public.service_versions (
    id, service_id, workspace_id, version_number, status, name_snapshot, description_snapshot,
    base_price_minor, currency, setup_duration_minutes, breakdown_duration_minutes, difficulty_score,
    experience_level_required, weather_sensitivity, surprise_friendly, estimated_profit_minor,
    change_summary, published_at, published_by
  )
  values (
    v_new_draft_id, v_published.service_id, v_published.workspace_id, null, 'draft', null, null,
    v_published.base_price_minor, v_published.currency, v_published.setup_duration_minutes,
    v_published.breakdown_duration_minutes, v_published.difficulty_score,
    v_published.experience_level_required, v_published.weather_sensitivity, v_published.surprise_friendly,
    v_published.estimated_profit_minor, null, null, null
  );

  insert into public.service_included_items (id, workspace_id, service_version_id, label, description, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, label, description, display_order, now(), now()
    from public.service_included_items where service_version_id = v_draft.id;

  insert into public.service_addons (id, workspace_id, service_version_id, label, description, price_delta_minor, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, label, description, price_delta_minor, display_order, now(), now()
    from public.service_addons where service_version_id = v_draft.id;

  insert into public.service_checklist_template_items (id, workspace_id, service_version_id, title, description, category, priority, due_offset_days, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, title, description, category, priority, due_offset_days, display_order, now(), now()
    from public.service_checklist_template_items where service_version_id = v_draft.id;

  insert into public.service_timeline_template_items (id, workspace_id, service_version_id, title, description, category, offset_minutes_from_event_start, duration_minutes, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, title, description, category, offset_minutes_from_event_start, duration_minutes, display_order, now(), now()
    from public.service_timeline_template_items where service_version_id = v_draft.id;

  insert into public.service_questionnaire_questions (id, workspace_id, service_version_id, question_text, question_type, is_required, options, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, question_text, question_type, is_required, options, display_order, now(), now()
    from public.service_questionnaire_questions where service_version_id = v_draft.id;

  insert into public.service_budget_template_lines (id, workspace_id, service_version_id, label, category, estimated_revenue_minor, estimated_cost_minor, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, label, category, estimated_revenue_minor, estimated_cost_minor, display_order, now(), now()
    from public.service_budget_template_lines where service_version_id = v_draft.id;

  insert into public.service_approval_template_items (id, workspace_id, service_version_id, label, description, days_before_event_deadline, required_role, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, label, description, days_before_event_deadline, required_role, display_order, now(), now()
    from public.service_approval_template_items where service_version_id = v_draft.id;

  insert into public.service_travel_template_items (id, workspace_id, service_version_id, label, description, requires_equipment_transport, drive_time_buffer_minutes, mileage_estimate, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, label, description, requires_equipment_transport, drive_time_buffer_minutes, mileage_estimate, display_order, now(), now()
    from public.service_travel_template_items where service_version_id = v_draft.id;

  insert into public.service_required_documents (id, workspace_id, service_version_id, label, category, is_required, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, label, category, is_required, display_order, now(), now()
    from public.service_required_documents where service_version_id = v_draft.id;

  insert into public.service_ai_knowledge_items (id, workspace_id, service_version_id, knowledge_type, content, severity, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, knowledge_type, content, severity, display_order, now(), now()
    from public.service_ai_knowledge_items where service_version_id = v_draft.id;

  insert into public.service_inventory_template_items (id, workspace_id, service_version_id, inventory_item_id, item_name, quantity, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, inventory_item_id, item_name, quantity, display_order, now(), now()
    from public.service_inventory_template_items where service_version_id = v_draft.id;

  insert into public.service_purchase_template_items (id, workspace_id, service_version_id, item_name, estimated_unit_cost_minor, estimated_quantity, typical_vendor_id, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, item_name, estimated_unit_cost_minor, estimated_quantity, typical_vendor_id, display_order, now(), now()
    from public.service_purchase_template_items where service_version_id = v_draft.id;

  insert into public.service_vendor_suggestions (id, workspace_id, service_version_id, vendor_id, note, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, vendor_id, note, display_order, now(), now()
    from public.service_vendor_suggestions where service_version_id = v_draft.id;

  insert into public.service_team_role_requirements (id, workspace_id, service_version_id, role_label, quantity, note, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, role_label, quantity, note, display_order, now(), now()
    from public.service_team_role_requirements where service_version_id = v_draft.id;

  insert into public.service_seasonal_windows (id, workspace_id, service_version_id, start_month, end_month, note, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, start_month, end_month, note, now(), now()
    from public.service_seasonal_windows where service_version_id = v_draft.id;

  insert into public.service_capability_requirements (id, workspace_id, service_version_id, capability_type, label, display_order, created_at, updated_at)
    select gen_random_uuid(), workspace_id, v_new_draft_id, capability_type, label, display_order, now(), now()
    from public.service_capability_requirements where service_version_id = v_draft.id;

  update public.services
  set draft_version_id = v_new_draft_id,
      current_published_version_id = v_draft.id,
      updated_at = now()
  where id = p_service_id;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_service.workspace_id, 'service', v_service.id, 'service_version_published',
    'Version ' || v_version_number || ' published for "' || v_service.name || '"', p_actor,
    jsonb_build_object('version_number', v_version_number)
  );

  return v_published;
end;
$$;

comment on function public.publish_service_version(uuid, text, text) is
  'Atomic, row-locked publish operation: freezes the current draft (stamping version_number/name_snapshot/description_snapshot/publish audit fields), deep-copies all 16 template tables'' rows into a brand new draft, repoints services.draft_version_id/current_published_version_id, and logs one Timeline entry — all in one transaction.';
