-- Documents migration 7 of 8: RLS enablement + policies for documents and
-- document_folders.
--
-- Same shape as every previous business-module RLS migration: Workspace
-- isolation only via is_workspace_member(workspace_id), no owner/admin role
-- gating, no anonymous access. No policy uses a bare `using (true)`.
--
-- No delete policy on either table — Documents are soft-deleted
-- (status = 'deleted' + deleted_at, reversible via restoreDocument) and
-- Folders are archived (archived_at, reversible via restoreDocumentFolder);
-- neither is ever physically removed by the app. MediaAsset access (the
-- linked physical file) remains governed entirely by the existing
-- media_assets table RLS and Storage object policies — this migration does
-- not touch those.

alter table public.documents enable row level security;
alter table public.document_folders enable row level security;

create policy "documents_select_workspace_member"
  on public.documents for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "documents_insert_workspace_member"
  on public.documents for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "documents_update_workspace_member"
  on public.documents for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "document_folders_select_workspace_member"
  on public.document_folders for select
  to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "document_folders_insert_workspace_member"
  on public.document_folders for insert
  to authenticated
  with check (public.is_workspace_member(workspace_id));

create policy "document_folders_update_workspace_member"
  on public.document_folders for update
  to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));
