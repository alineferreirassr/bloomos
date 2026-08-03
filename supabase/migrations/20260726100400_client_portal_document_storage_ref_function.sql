-- Client Portal MVP migration 5 of 5: client-safe document storage
-- reference function.
--
-- There is no SQL-level way to mint a Storage signed URL directly —
-- signing requires the Storage service's own signing capability, not
-- Postgres. This function is therefore the validation half of a two-step
-- flow, mirroring exactly how the existing internal
-- getMediaAssetDownloadUrl() already works (lib/data/media/
-- supabaseRepository.ts): resolve the caller's authorization first, then
-- let TypeScript exchange the returned bucket/path for an actual signed
-- URL via supabase.storage.from(bucket).createSignedUrl(path, expiresIn).
--
-- Security definer, narrowly scoped: takes only a Document id (never a
-- media_asset_id directly, so a caller can never probe an arbitrary
-- MediaAsset — they must go through a Document they're already
-- authorized to see), and validates every condition itself rather than
-- trusting the documents_select_client_account RLS policy alone (this
-- function bypasses RLS as security definer, so it re-derives the exact
-- same authorization check inline). Returns only storage_bucket/
-- storage_path — never any other Document or MediaAsset field, and never
-- a signed URL itself (this function cannot generate one). The calling
-- repository function (getClientPortalDocumentDownloadUrl) is the only
-- code that ever sees this return value — it must immediately exchange it
-- for a signed URL and return only that URL to the UI; this function's
-- return type is deliberately never propagated to the browser as-is.
create or replace function public.get_client_document_storage_ref(p_document_id uuid)
returns table (
  storage_bucket text,
  storage_path text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_document public.documents%rowtype;
  v_media_asset public.media_assets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to access this document.' using errcode = 'P0121';
  end if;

  select * into v_document from public.documents where id = p_document_id;

  if not found then
    raise exception 'This document is not available.' using errcode = 'P0122';
  end if;

  if v_document.client_id is null
     or v_document.visibility not in ('client', 'client_and_team')
     or not public.is_client_account_holder_in_workspace(v_document.workspace_id, v_document.client_id)
  then
    raise exception 'You do not have access to this document.' using errcode = 'P0123';
  end if;

  if v_document.media_asset_id is null then
    raise exception 'This document has no file attached.' using errcode = 'P0124';
  end if;

  select * into v_media_asset from public.media_assets where id = v_document.media_asset_id;

  if not found then
    raise exception 'The file behind this document is not available.' using errcode = 'P0125';
  end if;

  return query select v_media_asset.storage_bucket, v_media_asset.storage_path;
end;
$$;

comment on function public.get_client_document_storage_ref(uuid) is
  'Security definer: validates a Client Portal caller''s access to a Document (client_id + visibility + active client_accounts row) and returns only its storage_bucket/storage_path, for immediate exchange into a signed URL server-side. Never returns a signed URL itself, never accepts a media_asset_id directly, never returns any other field.';

revoke all on function public.get_client_document_storage_ref(uuid) from public;
grant execute on function public.get_client_document_storage_ref(uuid) to authenticated;
