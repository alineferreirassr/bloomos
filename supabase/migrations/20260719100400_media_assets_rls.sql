-- Media Library migration 5 of 6: RLS enablement + policies for
-- media_assets.
--
-- Same shape as leads_rls.sql/clients_rls.sql/events_rls.sql: Workspace
-- isolation only via is_workspace_member(workspace_id), no owner/admin role
-- gating, no anonymous access. No policy uses a bare `using (true)`.
--
-- No delete policy — soft delete via archived_at, reversible via
-- restoreMediaAsset(), never a physical DELETE from this table (unlike the
-- storage.objects policies in migration 2, which do need a delete policy
-- for the best-effort upload-rollback cleanup path).

alter table public.media_assets enable row level security;

create policy "media_assets_select_workspace_member"
  on public.media_assets for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "media_assets_insert_workspace_member"
  on public.media_assets for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "media_assets_update_workspace_member"
  on public.media_assets for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
