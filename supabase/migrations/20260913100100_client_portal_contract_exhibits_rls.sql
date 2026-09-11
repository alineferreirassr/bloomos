-- CONTRACTS-02 — additive client-facing RLS for contract_exhibits.
--
-- 20260726100100_client_portal_clients_events_contracts_rls.sql deliberately
-- skipped contract_exhibits ("no visibility model exists on exhibits yet").
-- CONTRACTS-02 activates the real Contract Detail's signature/PDF flow for
-- clients, and an exhibit is part of what a client needs to see about their
-- own contract — this closes that gap the same additive way every other
-- Client Portal policy in this codebase was added: alongside the existing
-- is_workspace_member-only policies (20260720100600_contracts_rls.sql),
-- never replacing them. Postgres OR-combines multiple permissive policies
-- for the same command, so internal team access is unaffected.
--
-- contract_exhibits has its own workspace_id column but no client_id column
-- (only contract_id) — ownership can only be re-derived by joining through
-- contracts, exactly like events/clients' client-facing policies re-derive
-- through their own owning tables. Never trust contract_exhibits' own
-- workspace_id alone for this check; the join to contracts.client_id is
-- what actually scopes it to the caller's own Client record.
create policy "contract_exhibits_select_client_account"
  on public.contract_exhibits for select
  to authenticated
  using (
    exists (
      select 1
      from public.contracts
      where contracts.id = contract_exhibits.contract_id
        and public.is_client_account_holder_in_workspace(contracts.workspace_id, contracts.client_id)
    )
  );
