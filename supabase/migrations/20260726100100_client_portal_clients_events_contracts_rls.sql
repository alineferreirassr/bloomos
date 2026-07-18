-- Client Portal MVP migration 2 of 5: additive client-facing RLS for
-- clients, events, and contracts.
--
-- Every policy below is additive — created alongside the existing
-- is_workspace_member(workspace_id)-only policies from each module's own
-- migration phase, never replacing or altering them. Postgres evaluates
-- multiple permissive policies for the same command with OR semantics, so
-- an internal team member's existing access is completely unaffected; a
-- Client Portal caller (no workspace_members row at all) is granted a
-- second, narrower path scoped to their own Client record only.
--
-- clients: a client reads only their own row (id = the client_id their
-- own active client_accounts row is linked to).
create policy "clients_select_client_account"
  on public.clients for select
  to authenticated
  using (public.is_client_account_holder_in_workspace(workspace_id, id));

-- events: a client reads only Events belonging to their own Client record.
create policy "events_select_client_account"
  on public.events for select
  to authenticated
  using (public.is_client_account_holder_in_workspace(workspace_id, client_id));

-- contracts: a client reads only Contracts belonging to their own Client
-- record. contract_exhibits deliberately gets no client-facing policy
-- this phase — see docs/permissions.md's Client Portal MVP section for
-- why (no visibility model exists on exhibits yet).
create policy "contracts_select_client_account"
  on public.contracts for select
  to authenticated
  using (public.is_client_account_holder_in_workspace(workspace_id, client_id));
