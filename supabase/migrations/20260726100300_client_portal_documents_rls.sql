-- Client Portal MVP migration 4 of 5: additive client-facing RLS for
-- documents and document_folders.
--
-- documents: a client reads a Document only when ALL of the following
-- hold: the Document's `client_id` cross-reference field is populated
-- (this is a deliberate scoping decision, not a bug — `client_id` on
-- `documents` exists specifically as a cross-module lookup field per its
-- own type doc comment; a Document attached only via `owner_type`/
-- `owner_id` to an Event/Contract/etc. with `client_id` left null will not
-- appear here — internal staff must populate `client_id` when a document
-- should be Client Portal-visible, the same way they already set
-- `visibility`); `visibility` is `client` or `client_and_team`; and the
-- caller holds an active client_accounts row for that Client in the same
-- Workspace. This is the first policy in this schema to combine
-- Workspace/Client scoping with a `visibility` check — every other
-- module's client-facing policy is client_id-only, since Documents is the
-- only domain with a visibility concept at all today.
create policy "documents_select_client_account"
  on public.documents for select
  to authenticated
  using (
    client_id is not null
    and visibility in ('client', 'client_and_team')
    and public.is_client_account_holder_in_workspace(workspace_id, client_id)
  );

-- document_folders: deliberately non-recursive for this phase — a folder
-- has no client_id column at all (only polymorphic owner_type/owner_id),
-- so visibility is derived, not stored. A folder is readable only if it
-- DIRECTLY contains at least one Document the same client can already
-- see via the policy above — never an unrelated internal folder tree, and
-- never a folder whose only client-visible content lives in a child
-- folder (recursive folder-tree visibility is out of scope this phase).
create policy "document_folders_select_client_account"
  on public.document_folders for select
  to authenticated
  using (
    exists (
      select 1
      from public.documents d
      where d.folder_id = document_folders.id
        and d.client_id is not null
        and d.visibility in ('client', 'client_and_team')
        and public.is_client_account_holder_in_workspace(d.workspace_id, d.client_id)
    )
  );
