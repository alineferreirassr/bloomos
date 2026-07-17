-- Contracts migration 7 of 8: RLS enablement + policies for contracts,
-- contract_templates, and contract_exhibits.
--
-- Same shape as leads_rls.sql/clients_rls.sql/events_rls.sql/
-- media_assets_rls.sql: Workspace isolation only via
-- is_workspace_member(workspace_id), no owner/admin role gating, no
-- anonymous access. No policy uses a bare `using (true)`.
--
-- contracts: no delete policy — soft delete via status = 'archived' +
-- archived_at, reversible via restoreContract(), never a physical DELETE.
--
-- contract_templates: select only — no insert/update/delete policy. The
-- current public API has no createContractTemplate/updateContractTemplate
-- ("no editor yet"); granting write policies with no app code that ever
-- uses them is needless attack surface. Widen when a template editor ships,
-- the same "add a policy only when the app needs it" discipline as every
-- other table in this schema.
--
-- contract_exhibits: DOES get a delete policy, since deleteContractExhibit
-- physically deletes rows — same precedent as checklist_items/
-- event_schedule_items. No lock-state guard here either; that stays a
-- UI-layer concern, matching the existing data-layer division of
-- responsibility (see the code comment above getContractExhibitsByContractId
-- in lib/data/index.ts).
--
-- Notes/timeline_activities needed no new policies for Contract-owned
-- rows — their existing is_workspace_member(workspace_id) policies already
-- cover any owner_type; only the CHECK constraint governing which
-- owner_type/type values are accepted needed widening (migration 4).

alter table public.contracts enable row level security;
alter table public.contract_templates enable row level security;
alter table public.contract_exhibits enable row level security;

create policy "contracts_select_workspace_member"
  on public.contracts for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "contracts_insert_workspace_member"
  on public.contracts for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "contracts_update_workspace_member"
  on public.contracts for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "contract_templates_select_workspace_member"
  on public.contract_templates for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "contract_exhibits_select_workspace_member"
  on public.contract_exhibits for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "contract_exhibits_insert_workspace_member"
  on public.contract_exhibits for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "contract_exhibits_update_workspace_member"
  on public.contract_exhibits for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "contract_exhibits_delete_workspace_member"
  on public.contract_exhibits for delete
  to authenticated
  using (public.is_workspace_member(workspace_id));
