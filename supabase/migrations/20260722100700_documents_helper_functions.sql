-- Documents migration 8 of 8: helper functions for atomic version creation
-- (with latest-version enforcement) and folder-template application.
--
-- Both `security invoker` (not `security definer`), same rationale as
-- convert_lead_to_client/apply_default_event_checklist/
-- recompute_invoice_balance: every read/write inside is still governed by
-- the caller's own RLS policies, no service_role needed.
--
-- Folder-move cycle prevention is deliberately NOT a SQL function here —
-- it stays TypeScript-side (core/workflows/documentFolderWorkflow.ts's
-- wouldCreateFolderCycle/canMoveFolder, fetch-then-validate-then-write),
-- exactly matching how every other workflow-transition check in this
-- codebase already works (Contract/Event status transitions are never
-- SQL-side either). A folder tree is small per-owner and a true
-- concurrent-move race is a low-value edge case not worth a bespoke
-- recursive-CTE function — the "where practical" the spec allows for.

-- ---------------------------------------------------------------------------
-- create_document_version — the atomic equivalent of the mock's
-- createDocumentVersion(): row-locks the current latest version in the
-- chain, inserts the new version row (optionally linked to a MediaAsset
-- already uploaded by the caller), flips the previous latest version to
-- superseded, and logs both Timeline entries — all in one transaction, so
-- a reader can never observe a moment with zero or two "latest" versions
-- in a chain. p_document_id may be any version's id in the chain, matching
-- the mock's documentChain() lookup. p_title/p_visibility null means
-- "inherit from the version being superseded"; p_expires_at_provided
-- distinguishes an explicit null (clear the expiration) from "not
-- provided" (inherit), mirroring the mock's exact semantics.
-- ---------------------------------------------------------------------------

create or replace function public.create_document_version(
  p_document_id uuid,
  p_media_asset_id uuid,
  p_title text,
  p_visibility text,
  p_expires_at_provided boolean,
  p_expires_at timestamptz,
  p_uploaded_by uuid,
  p_actor text
)
returns public.documents
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_anchor public.documents;
  v_root_id uuid;
  v_latest public.documents;
  v_new public.documents;
  v_title text;
  v_visibility text;
  v_expires_at timestamptz;
begin
  select * into v_anchor from public.documents where id = p_document_id;
  if not found then
    raise exception 'Document not found.' using errcode = 'P0001';
  end if;

  v_root_id := coalesce(v_anchor.parent_document_id, v_anchor.id);

  select * into v_latest from public.documents
  where (id = v_root_id or parent_document_id = v_root_id) and is_latest_version = true
  for update;

  if not found then
    raise exception 'This document has no current version to supersede.' using errcode = 'P0002';
  end if;
  if v_latest.status = 'deleted' then
    raise exception 'This document has been deleted and cannot receive a new version.' using errcode = 'P0003';
  end if;

  v_title := case when p_title is not null and length(p_title) > 0 then p_title else v_latest.title end;
  v_visibility := coalesce(p_visibility, v_latest.visibility);
  v_expires_at := case when p_expires_at_provided then p_expires_at else v_latest.expires_at end;

  insert into public.documents (
    workspace_id, owner_type, owner_id, folder_id, title, description, category, status, visibility,
    media_asset_id, version, is_latest_version, parent_document_id,
    contract_exhibit_id, event_id, client_id, contract_id, invoice_id, payment_id, expense_id,
    uploaded_by, uploaded_at, expires_at
  ) values (
    v_latest.workspace_id, v_latest.owner_type, v_latest.owner_id, v_latest.folder_id,
    v_title, v_latest.description, v_latest.category, 'active', v_visibility,
    p_media_asset_id, v_latest.version + 1, true, v_root_id,
    v_latest.contract_exhibit_id, v_latest.event_id, v_latest.client_id, v_latest.contract_id,
    v_latest.invoice_id, v_latest.payment_id, v_latest.expense_id,
    p_uploaded_by, now(), v_expires_at
  )
  returning * into v_new;

  update public.documents
  set status = 'superseded', is_latest_version = false, updated_at = now()
  where id = v_latest.id;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (v_new.workspace_id, 'document', v_new.id, 'document_version_created',
          'New version uploaded: "' || v_new.title || '" (v' || v_new.version || ')', p_actor);

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (v_latest.workspace_id, 'document', v_latest.id, 'document_superseded',
          'Superseded by version ' || v_new.version, p_actor);

  return v_new;
end;
$$;

comment on function public.create_document_version(uuid, uuid, text, text, boolean, timestamptz, uuid, text) is
  'Atomic, row-locked equivalent of the mock''s createDocumentVersion() — inserts the new version, supersedes the prior latest version, and logs both Timeline entries in one transaction.';

-- ---------------------------------------------------------------------------
-- apply_default_folder_template — the atomic equivalent of the mock's
-- applyDefaultFolderTemplate(): inserts every folder name in p_names as a
-- single batch and records exactly one summarized
-- document_folder_template_applied Timeline entry. p_workspace_id is
-- passed explicitly (unlike apply_default_event_checklist, which derives
-- it from the single Event row it operates on) because a folder's owner
-- is polymorphic across 7 possible tables — there's no one table to look
-- the workspace up from.
-- ---------------------------------------------------------------------------

create or replace function public.apply_default_folder_template(
  p_workspace_id uuid,
  p_owner_type text,
  p_owner_id uuid,
  p_names text[],
  p_parent_folder_id uuid,
  p_actor text,
  p_template_kind text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_name text;
  v_index integer := 0;
  v_inserted public.document_folders%rowtype;
  v_new_folders jsonb := '[]'::jsonb;
begin
  foreach v_name in array p_names
  loop
    insert into public.document_folders (
      workspace_id, owner_type, owner_id, parent_folder_id, name, description, sort_order, visibility
    ) values (
      p_workspace_id, p_owner_type, p_owner_id, p_parent_folder_id, v_name, null, v_index, 'internal'
    )
    returning * into v_inserted;

    v_new_folders := v_new_folders || to_jsonb(v_inserted);
    v_index := v_index + 1;
  end loop;

  insert into public.timeline_activities (workspace_id, owner_type, owner_id, type, description, actor)
  values (
    p_workspace_id, p_owner_type, p_owner_id, 'document_folder_template_applied',
    'Default ' || p_template_kind || ' folder template applied with ' || array_length(p_names, 1) || ' folder' ||
      (case when array_length(p_names, 1) = 1 then '' else 's' end) || '.',
    p_actor
  );

  return v_new_folders;
end;
$$;

comment on function public.apply_default_folder_template(uuid, text, uuid, text[], uuid, text, text) is
  'Atomically inserts a default folder template''s folders and records one summarized document_folder_template_applied timeline entry.';
