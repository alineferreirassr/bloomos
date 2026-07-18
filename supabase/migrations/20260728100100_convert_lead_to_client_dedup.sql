-- Phase 2 (Booking Workflow) migration 2 of 2: convert_lead_to_client now
-- checks for an existing Client (same workspace, case/whitespace-insensitive
-- email match) before inserting a new one — closing the "Never duplicate
-- Clients" gap found during the Booking Workflow architecture audit. Every
-- other validation/behavior is unchanged: same rejections (not found,
-- archived, already converted), same two timeline entries pattern, same
-- `security invoker` (RLS still governs every statement), same return shape.
--
-- When an existing Client is matched, its own `originating_lead_id` is only
-- backfilled if currently null (first-touch wins) — a returning client's
-- true original conversion is never overwritten by a later, unrelated Lead
-- that happens to reach out again with the same email.

create or replace function public.convert_lead_to_client(p_lead_id uuid, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_client public.clients%rowtype;
  v_existing_client_id uuid;
begin
  select * into v_lead from public.leads where id = p_lead_id for update;

  if not found then
    raise exception 'Lead not found.' using errcode = 'P0001';
  end if;

  if v_lead.status = 'archived' then
    raise exception 'Archived leads cannot be converted to a Client.' using errcode = 'P0001';
  end if;

  if v_lead.status = 'converted' or v_lead.converted_client_id is not null then
    raise exception 'This lead has already been converted to a Client.' using errcode = 'P0001';
  end if;

  select id into v_existing_client_id
  from public.clients
  where workspace_id = v_lead.workspace_id
    and lower(trim(email)) = lower(trim(v_lead.email))
  order by created_at asc
  limit 1;

  if v_existing_client_id is not null then
    update public.clients
    set originating_lead_id = coalesce(originating_lead_id, v_lead.id)
    where id = v_existing_client_id
    returning * into v_client;
  else
    insert into public.clients (
      workspace_id, originating_lead_id, first_name, last_name, email, phone, instagram, source, internal_status
    ) values (
      v_lead.workspace_id, v_lead.id, v_lead.first_name, v_lead.last_name, v_lead.email, v_lead.phone,
      v_lead.instagram, v_lead.source, 'active'
    )
    returning * into v_client;
  end if;

  update public.leads
  set status = 'converted', converted_client_id = v_client.id
  where id = v_lead.id
  returning * into v_lead;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_lead.workspace_id, 'lead', v_lead.id, 'lead_converted', 'Lead converted to Client', p_actor,
    jsonb_build_object('client_id', v_client.id)
  );

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor, metadata)
  values (
    v_client.workspace_id, 'client', v_client.id,
    case when v_existing_client_id is not null then 'client_updated' else 'client_created' end,
    case
      when v_existing_client_id is not null then 'Converted Lead linked to existing Client'
      else 'Client created from converted Lead'
    end,
    p_actor,
    jsonb_build_object('originating_lead_id', v_lead.id, 'reused_existing_client', v_existing_client_id is not null)
  );

  return jsonb_build_object('lead', to_jsonb(v_lead), 'client', to_jsonb(v_client));
end;
$$;

comment on function public.convert_lead_to_client(uuid, text) is
  'Atomically converts a Lead to a Client: validates, reuses an existing Client by email match (same workspace) or inserts a new one, updates the Lead, records both timeline entries. security invoker so RLS on leads/clients/timeline_activities still applies to the calling user.';
