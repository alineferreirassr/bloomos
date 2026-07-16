import type { MediaAsset } from "@/types/mediaAsset";
import type { EntityType } from "@/core/enums/entityType";
import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapMediaAssetRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import { uploadMediaAssetInputSchema, replaceMediaAssetVersionInputSchema } from "@/lib/media/schema";
import {
  extractFileExtension,
  validateMimeType,
  validateFileSize,
  generateStoredFilename,
  generateStoragePath,
} from "@/lib/media/mediaFile";
import { calculateChecksum } from "@/lib/media/checksum";
import { detectImageDimensions } from "@/lib/media/imageMetadata";
import type {
  MediaAssetFilters,
  MediaAssetsRepository,
  UploadMediaAssetInput,
  ReplaceMediaAssetVersionInput,
  MediaAssetDownload,
  MediaAssetDownloadUrl,
  MediaAssetChecksumVerification,
} from "@/lib/data/media/repository";

const BUCKET = "media-assets";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

/** Same rationale as leads/clients/events supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/** Records a Timeline entry against the media asset's owning entity — the same pattern checklist/schedule items use against their owning Event. Never against the media asset itself, since timeline_activities' owner_type CHECK doesn't (and doesn't need to) include 'media_asset'. */
async function insertTimelineActivity(
  supabase: SupabaseClient,
  actor: string,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  type: TimelineActivityType,
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Internal existence check — returns null rather than throwing, matching every other Supabase repository's fetchXRow pattern. RLS means an asset in another Workspace is simply invisible here, not a distinct error case. */
async function fetchMediaAssetRow(id: string): Promise<MediaAsset | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("media_assets").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapMediaAssetRow(data) : null;
}

/** Best-effort cleanup after a storage upload succeeds but the following DB write fails — never lets a secondary cleanup error mask the original failure. */
async function removeStorageObjectQuietly(supabase: SupabaseClient, path: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([path]);
  } catch {
    // Orphaned storage object — acceptable; the DB write's own error is what surfaces to the caller.
  }
}

async function getMediaAssetById(id: string): Promise<MediaAsset> {
  const asset = await fetchMediaAssetRow(id);
  if (!asset) {
    throw new NotFoundError(`Media asset ${id} was not found`);
  }
  return asset;
}

async function getMediaAssetsByOwner(
  ownerType: EntityType,
  ownerId: string,
  filters: MediaAssetFilters = {},
): Promise<MediaAsset[]> {
  const { includeArchived = false } = filters;
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  let query = supabase
    .from("media_assets")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId);
  if (!includeArchived) query = query.is("archived_at", null);

  const { data, error } = await query.order("created_at", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapMediaAssetRow);
}

async function uploadMediaAsset(input: UploadMediaAssetInput): Promise<DataResult<MediaAsset>> {
  const parsed = uploadMediaAssetInputSchema.safeParse({
    ownerType: input.ownerType,
    ownerId: input.ownerId,
    originalFilename: input.originalFilename,
  });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const extension = extractFileExtension(input.originalFilename);
  const mimeType = input.mimeType || input.file.type || "application/octet-stream";

  const mimeCheck = validateMimeType(mimeType, extension);
  if (!mimeCheck.valid) {
    return fail(mimeCheck.error ?? "Unsupported file type.", { file: mimeCheck.error ?? "Unsupported file type." });
  }

  const sizeCheck = validateFileSize(input.file.size, mimeType);
  if (!sizeCheck.valid) {
    return fail(sizeCheck.error ?? "File is too large.", { file: sizeCheck.error ?? "File is too large." });
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const workspaceId = session.workspace.id;

  const id = crypto.randomUUID();
  const version = 1;
  const storedFilename = generateStoredFilename(input.originalFilename);
  const storagePath = generateStoragePath({
    workspaceId,
    ownerType: parsed.data.ownerType,
    ownerId: parsed.data.ownerId,
    mediaAssetId: id,
    version,
    storedFilename,
  });

  const bytes = await input.file.arrayBuffer();
  const checksum = await calculateChecksum(bytes);
  const dimensions = await detectImageDimensions(input.file, mimeType);

  const supabase = createSupabaseClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw normalizeSupabaseError(uploadError);

  const { data, error } = await supabase
    .from("media_assets")
    .insert({
      id,
      workspace_id: workspaceId,
      owner_type: parsed.data.ownerType,
      owner_id: parsed.data.ownerId,
      original_filename: input.originalFilename,
      stored_filename: storedFilename,
      storage_bucket: BUCKET,
      storage_path: storagePath,
      mime_type: mimeType,
      extension,
      file_size: input.file.size,
      checksum,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      duration: null,
      version,
      uploaded_by: session.user.id,
    })
    .select("*")
    .single();
  if (error) {
    await removeStorageObjectQuietly(supabase, storagePath);
    throw normalizeSupabaseError(error);
  }

  const asset = mapMediaAssetRow(data);
  await insertTimelineActivity(
    supabase,
    actor,
    workspaceId,
    asset.owner_type,
    asset.owner_id,
    "media_asset_uploaded",
    `File uploaded: "${input.originalFilename}"`,
  );

  return ok(asset);
}

async function replaceMediaAssetVersion(
  id: string,
  input: ReplaceMediaAssetVersionInput,
): Promise<DataResult<MediaAsset>> {
  const existing = await fetchMediaAssetRow(id);
  if (!existing) {
    return fail("Media asset not found.");
  }
  if (existing.archived_at) {
    return fail("Archived files can't be replaced — restore it first.");
  }

  const parsed = replaceMediaAssetVersionInputSchema.safeParse({ originalFilename: input.originalFilename });
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const extension = extractFileExtension(input.originalFilename);
  const mimeType = input.mimeType || input.file.type || "application/octet-stream";

  const mimeCheck = validateMimeType(mimeType, extension);
  if (!mimeCheck.valid) {
    return fail(mimeCheck.error ?? "Unsupported file type.", { file: mimeCheck.error ?? "Unsupported file type." });
  }

  const sizeCheck = validateFileSize(input.file.size, mimeType);
  if (!sizeCheck.valid) {
    return fail(sizeCheck.error ?? "File is too large.", { file: sizeCheck.error ?? "File is too large." });
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);

  const nextVersion = existing.version + 1;
  const storedFilename = generateStoredFilename(input.originalFilename);
  const storagePath = generateStoragePath({
    workspaceId: existing.workspace_id,
    ownerType: existing.owner_type,
    ownerId: existing.owner_id,
    mediaAssetId: existing.id,
    version: nextVersion,
    storedFilename,
  });

  const bytes = await input.file.arrayBuffer();
  const checksum = await calculateChecksum(bytes);
  const dimensions = await detectImageDimensions(input.file, mimeType);

  const supabase = createSupabaseClient();
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, input.file, {
    contentType: mimeType,
    upsert: false,
  });
  if (uploadError) throw normalizeSupabaseError(uploadError);

  const { data, error } = await supabase
    .from("media_assets")
    .update({
      original_filename: input.originalFilename,
      stored_filename: storedFilename,
      storage_path: storagePath,
      mime_type: mimeType,
      extension,
      file_size: input.file.size,
      checksum,
      width: dimensions?.width ?? null,
      height: dimensions?.height ?? null,
      version: nextVersion,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    await removeStorageObjectQuietly(supabase, storagePath);
    throw normalizeSupabaseError(error);
  }

  const updated = mapMediaAssetRow(data);
  await insertTimelineActivity(
    supabase,
    actor,
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    "media_asset_version_replaced",
    `File replaced with a new version: "${input.originalFilename}" (v${nextVersion})`,
    { from_version: existing.version, to_version: nextVersion },
  );

  return ok(updated);
}

async function downloadMediaAsset(id: string): Promise<DataResult<MediaAssetDownload>> {
  const existing = await fetchMediaAssetRow(id);
  if (!existing) {
    return fail("Media asset not found.");
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.storage.from(existing.storage_bucket).download(existing.storage_path);
  if (error) throw normalizeSupabaseError(error);

  return ok({ blob: data, mediaAsset: existing });
}

async function getMediaAssetDownloadUrl(
  id: string,
  expiresInSeconds = 3600,
): Promise<DataResult<MediaAssetDownloadUrl>> {
  const existing = await fetchMediaAssetRow(id);
  if (!existing) {
    return fail("Media asset not found.");
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.storage
    .from(existing.storage_bucket)
    .createSignedUrl(existing.storage_path, expiresInSeconds);
  if (error) throw normalizeSupabaseError(error);

  return ok({
    url: data.signedUrl,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
}

async function verifyMediaAssetChecksum(id: string): Promise<DataResult<MediaAssetChecksumVerification>> {
  const existing = await fetchMediaAssetRow(id);
  if (!existing) {
    return fail("Media asset not found.");
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.storage.from(existing.storage_bucket).download(existing.storage_path);
  if (error) throw normalizeSupabaseError(error);

  const actualChecksum = await calculateChecksum(await data.arrayBuffer());
  return ok({
    valid: actualChecksum === existing.checksum,
    expectedChecksum: existing.checksum,
    actualChecksum,
  });
}

async function deleteMediaAsset(id: string): Promise<DataResult<MediaAsset>> {
  const existing = await fetchMediaAssetRow(id);
  if (!existing) {
    return fail("Media asset not found.");
  }
  if (existing.archived_at) {
    return fail("This file is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapMediaAssetRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    "media_asset_archived",
    `File archived: "${existing.original_filename}"`,
  );

  return ok(updated);
}

async function restoreMediaAsset(id: string): Promise<DataResult<MediaAsset>> {
  const existing = await fetchMediaAssetRow(id);
  if (!existing) {
    return fail("Media asset not found.");
  }
  if (!existing.archived_at) {
    return fail("This file is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("media_assets")
    .update({ archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapMediaAssetRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    "media_asset_restored",
    `File restored: "${existing.original_filename}"`,
  );

  return ok(updated);
}

export const supabaseMediaAssetsRepository: MediaAssetsRepository = {
  getMediaAssetById,
  getMediaAssetsByOwner,
  uploadMediaAsset,
  replaceMediaAssetVersion,
  downloadMediaAsset,
  getMediaAssetDownloadUrl,
  verifyMediaAssetChecksum,
  deleteMediaAsset,
  restoreMediaAsset,
};
