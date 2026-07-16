-- Clients migration 6 of 6: Lead -> Client conversion support.
--
-- Three parts:
--
-- 1. leads.converted_client_id can now carry a real foreign key, since
--    public.clients exists as of migration 1 of 6 (it was left as a bare
--    nullable uuid in 20260716100000_leads.sql for exactly this reason).
--
-- 2. clients.originating_lead_id gets a unique constraint (nulls are
--    distinct in Postgres, so any number of directly-created Clients with a
--    null originating_lead_id remain unaffected) — a database-level
--    safety net that makes a second Client ever pointing at the same
--    converted Lead impossible, on top of the row lock inside the function
--    below.
--
-- 3. public.convert_lead_to_client(uuid, text) — the single atomic entry
--    point the Supabase Clients repository calls via supabase.rpc(...) to
--    perform a conversion. `security invoker` (the default) is used
--    deliberately, NOT `security definer`: the function runs with the
--    calling user's own privileges, so every insert/update inside it is
--    still checked against the exact same RLS policies as if the caller had
--    issued those statements directly — no service-role credentials needed,
--    RLS remains the real enforcement boundary (matching every other
--    Supabase-backed write in this codebase).
--
--    `select ... for update` locks the Lead row for the duration of the
--    function's implicit transaction, so a second concurrent conversion
--    attempt blocks until the first commits, then observes
--    status = 'converted' and is rejected — this is what makes duplicate
--    conversion prevention atomic rather than a check-then-act race.
--    Any `raise exception` inside a plpgsql function rolls back everything
--    the function has done so far (Postgres function bodies are always one
--    transaction), so a rejected conversion never leaves a half-created
--    Client or a partially-updated Lead behind.
--
--    Field-copy semantics deliberately mirror
--    src/modules/leads/services/LeadConversionService.ts (the mock
--    implementation) exactly: only workspace_id, first_name, last_name,
--    email, phone, instagram, and source are copied from the Lead;
--    everything else defaults (internal_status = 'active', is_returning =
--    false, tags = '{}', all preference/relationship fields null/false).
--    No Event is created — that remains entirely out of scope.

alter table public.leads
  add constraint leads_converted_client_id_fkey
  foreign key (converted_client_id) references public.clients (id) on delete set null;

alter table public.clients
  add constraint clients_originating_lead_id_key unique (originating_lead_id);

create or replace function public.convert_lead_to_client(p_lead_id uuid, p_actor text)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_lead public.leads%rowtype;
  v_client public.clients%rowtype;
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

  insert into public.clients (
    workspace_id, originating_lead_id, first_name, last_name, email, phone, instagram, source, internal_status
  ) values (
    v_lead.workspace_id, v_lead.id, v_lead.first_name, v_lead.last_name, v_lead.email, v_lead.phone,
    v_lead.instagram, v_lead.source, 'active'
  )
  returning * into v_client;

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
    v_client.workspace_id, 'client', v_client.id, 'client_created', 'Client created from converted Lead', p_actor,
    jsonb_build_object('originating_lead_id', v_lead.id)
  );

  return jsonb_build_object('lead', to_jsonb(v_lead), 'client', to_jsonb(v_client));
end;
$$;

comment on function public.convert_lead_to_client(uuid, text) is
  'Atomically converts a Lead to a Client: validates, inserts the Client, updates the Lead, records both timeline entries. security invoker so RLS on leads/clients/timeline_activities still applies to the calling user.';

revoke all on function public.convert_lead_to_client(uuid, text) from public;
grant execute on function public.convert_lead_to_client(uuid, text) to authenticated;
