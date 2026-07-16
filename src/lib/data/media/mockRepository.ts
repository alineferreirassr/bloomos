import type { MediaAsset } from "@/types/mediaAsset";
import type { EntityType } from "@/core/enums/entityType";
import { NotFoundError } from "@/core/errors";
import { generateId, nowIso } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import {
  readMediaAssets,
  writeMediaAssets,
  readMediaAssetBlob,
  writeMediaAssetBlob,
} from "@/lib/data/mock/mediaAssetsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
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

async function getMediaAssetById(id: string): Promise<MediaAsset> {
  const asset = readMediaAssets().find((a) => a.id === id);
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
  return readMediaAssets()
    .filter((a) => a.owner_type === ownerType && a.owner_id === ownerId)
    .filter((a) => includeArchived || !a.archived_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
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

  const id = generateId("media");
  const version = 1;
  const storedFilename = generateStoredFilename(input.originalFilename);
  const storagePath = generateStoragePath({
    workspaceId: CURRENT_WORKSPACE_ID,
    ownerType: parsed.data.ownerType,
    ownerId: parsed.data.ownerId,
    mediaAssetId: id,
    version,
    storedFilename,
  });

  const bytes = await input.file.arrayBuffer();
  const checksum = await calculateChecksum(bytes);
  const dimensions = await detectImageDimensions(input.file, mimeType);

  const timestamp = nowIso();
  const asset: MediaAsset = {
    id,
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: parsed.data.ownerType,
    owner_id: parsed.data.ownerId,
    original_filename: input.originalFilename,
    stored_filename: storedFilename,
    storage_bucket: "media-assets",
    storage_path: storagePath,
    mime_type: mimeType,
    extension,
    file_size: input.file.size,
    checksum,
    width: dimensions?.width ?? null,
    height: dimensions?.height ?? null,
    duration: null,
    version,
    uploaded_by: null,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeMediaAssets([...readMediaAssets(), asset]);
  writeMediaAssetBlob(storagePath, input.file);
  recordTimelineActivity(
    asset.workspace_id,
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
  const existing = readMediaAssets().find((a) => a.id === id);
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

  const timestamp = nowIso();
  const updated: MediaAsset = {
    ...existing,
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
    updated_at: timestamp,
  };

  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  writeMediaAssetBlob(storagePath, input.file);
  recordTimelineActivity(
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
  const asset = readMediaAssets().find((a) => a.id === id);
  if (!asset) {
    return fail("Media asset not found.");
  }
  const blob = readMediaAssetBlob(asset.storage_path);
  if (!blob) {
    return fail("The file bytes for this asset are not available in this session.");
  }
  return ok({ blob, mediaAsset: asset });
}

async function getMediaAssetDownloadUrl(
  id: string,
  expiresInSeconds = 3600,
): Promise<DataResult<MediaAssetDownloadUrl>> {
  const asset = readMediaAssets().find((a) => a.id === id);
  if (!asset) {
    return fail("Media asset not found.");
  }
  return ok({
    url: `mock://media-assets/${asset.storage_path}`,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  });
}

async function verifyMediaAssetChecksum(id: string): Promise<DataResult<MediaAssetChecksumVerification>> {
  const asset = readMediaAssets().find((a) => a.id === id);
  if (!asset) {
    return fail("Media asset not found.");
  }
  const blob = readMediaAssetBlob(asset.storage_path);
  if (!blob) {
    return fail("The file bytes for this asset are not available in this session.");
  }
  const actualChecksum = await calculateChecksum(await blob.arrayBuffer());
  return ok({
    valid: actualChecksum === asset.checksum,
    expectedChecksum: asset.checksum,
    actualChecksum,
  });
}

async function deleteMediaAsset(id: string): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) {
    return fail("Media asset not found.");
  }
  if (existing.archived_at) {
    return fail("This file is already archived.");
  }

  const timestamp = nowIso();
  const updated: MediaAsset = { ...existing, archived_at: timestamp, updated_at: timestamp };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  recordTimelineActivity(
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    "media_asset_archived",
    `File archived: "${existing.original_filename}"`,
  );

  return ok(updated);
}

async function restoreMediaAsset(id: string): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) {
    return fail("Media asset not found.");
  }
  if (!existing.archived_at) {
    return fail("This file is not archived.");
  }

  const updated: MediaAsset = { ...existing, archived_at: null, updated_at: nowIso() };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  recordTimelineActivity(
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    "media_asset_restored",
    `File restored: "${existing.original_filename}"`,
  );

  return ok(updated);
}

export const mockMediaAssetsRepository: MediaAssetsRepository = {
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
