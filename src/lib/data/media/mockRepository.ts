import type { MediaAsset, MediaAssetMetadata } from "@/types/mediaAsset";
import type { EntityType } from "@/core/enums/entityType";
import type { MediaAssetStatus } from "@/core/enums/mediaAssetStatus";
import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaCollection } from "@/types/mediaCollection";
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
import { readMediaFolders, writeMediaFolders } from "@/lib/data/mock/mediaFoldersStore";
import { readMediaCollections, writeMediaCollections } from "@/lib/data/mock/mediaCollectionsStore";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { canMoveFolder } from "@/core/workflows/mediaFolderWorkflow";
import { mockKnowledgeGraphRepository } from "@/lib/data/core/knowledge/knowledgeGraphStore";
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
  MediaFolderFilters,
  MediaFolderInput,
  MediaFolderUpdateInput,
  MediaCollectionInput,
  MediaCollectionUpdateInput,
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
    folder_id: input.folderId ?? null,
    tags: [],
    color_label: null,
    priority: null,
    ai_ready: false,
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
    version_notes: null,
    metadata: { pages: null, author: null, license: null, brand: null, colorProfile: null, cameraData: null, location: null, custom: {} },
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
  // Step 10 — Entity Relationships. A thin, asset-scoped view over the same Knowledge Graph (Step 10.5), never a second parallel relationship system: every upload records the asset's ownership as a real graph edge.
  await mockKnowledgeGraphRepository.createRelationship(asset.workspace_id, "system", {
    sourceNodeType: "media_asset",
    sourceNodeId: asset.id,
    targetNodeType: asset.owner_type,
    targetNodeId: asset.owner_id,
    relationshipType: "belongs_to",
    source: "asset_upload",
  });

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
    version_notes: input.versionNotes ?? null,
    // A replaced version is a new file body — it goes back to "pending" so Step 9's Approval per Version is genuinely re-earned, never carried over from the prior version's approval.
    status: "pending",
    approved_by: null,
    approved_at: null,
    rejection_reason: null,
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

async function listMediaAssetsForWorkspace(workspaceId: string, filters: MediaAssetFilters = {}): Promise<MediaAsset[]> {
  const { includeArchived = false } = filters;
  return readMediaAssets()
    .filter((a) => a.workspace_id === workspaceId)
    .filter((a) => includeArchived || !a.archived_at)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

async function setMediaAssetFolder(id: string, folderId: string | null): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const updated: MediaAsset = { ...existing, folder_id: folderId, updated_at: nowIso() };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  recordTimelineActivity(
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    "media_asset_moved_to_folder",
    folderId ? `"${existing.original_filename}" moved to a folder` : `"${existing.original_filename}" removed from its folder`,
  );
  return ok(updated);
}

async function setMediaAssetTags(id: string, tags: string[]): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const updated: MediaAsset = { ...existing, tags: [...new Set(tags.map((t) => t.trim()).filter(Boolean))], updated_at: nowIso() };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function setMediaAssetColorLabel(id: string, colorLabel: string | null): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const updated: MediaAsset = { ...existing, color_label: colorLabel, updated_at: nowIso() };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function setMediaAssetPriority(id: string, priority: "low" | "normal" | "high" | null): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const updated: MediaAsset = { ...existing, priority, updated_at: nowIso() };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function setMediaAssetAiReady(id: string, aiReady: boolean): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const updated: MediaAsset = { ...existing, ai_ready: aiReady, updated_at: nowIso() };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function updateMediaAssetMetadata(id: string, patch: Partial<MediaAssetMetadata>): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const updated: MediaAsset = {
    ...existing,
    metadata: { ...existing.metadata, ...patch, custom: { ...existing.metadata.custom, ...(patch.custom ?? {}) } },
    updated_at: nowIso(),
  };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  return ok(updated);
}

async function setMediaAssetStatus(
  id: string,
  status: MediaAssetStatus,
  actor: string,
  rejectionReason: string | null = null,
  actorMemberId: string | null = null,
): Promise<DataResult<MediaAsset>> {
  const existing = readMediaAssets().find((a) => a.id === id);
  if (!existing) return fail("Media asset not found.");
  const timestamp = nowIso();
  const updated: MediaAsset = {
    ...existing,
    status,
    approved_by: status === "approved" ? actor : status === "pending" ? null : existing.approved_by,
    approved_at: status === "approved" ? timestamp : status === "pending" ? null : existing.approved_at,
    rejection_reason: status === "rejected" || status === "needs_revision" ? rejectionReason : null,
    updated_at: timestamp,
  };
  writeMediaAssets(readMediaAssets().map((a) => (a.id === id ? updated : a)));
  recordTimelineActivity(
    updated.workspace_id,
    updated.owner_type,
    updated.owner_id,
    status === "approved" ? "media_asset_approved" : status === "rejected" ? "media_asset_rejected" : status === "needs_revision" ? "media_asset_needs_revision" : "media_asset_status_reset",
    `"${existing.original_filename}" marked ${status.replace(/_/g, " ")} by ${actor}`,
  );

  // Step 10 — an approval/rejection is a real, auditable graph edge, not just a field on the asset row.
  if (actorMemberId && (status === "approved" || status === "rejected")) {
    await mockKnowledgeGraphRepository.createRelationship(updated.workspace_id, actorMemberId, {
      sourceNodeType: "media_asset",
      sourceNodeId: updated.id,
      targetNodeType: "team_member",
      targetNodeId: actorMemberId,
      relationshipType: status === "approved" ? "approved_by" : "rejected_by",
      source: "approval_workflow",
    });
  }

  return ok(updated);
}

// Checkpoint 25, Step 3 — Folders

async function getMediaFolders(filters: MediaFolderFilters = {}): Promise<MediaFolder[]> {
  const { ownerType, ownerId, parentFolderId, includeArchived = false } = filters;
  return readMediaFolders().filter((folder) => {
    if (ownerType !== undefined && folder.owner_type !== ownerType) return false;
    if (ownerId !== undefined && folder.owner_id !== ownerId) return false;
    if (parentFolderId !== undefined && folder.parent_folder_id !== parentFolderId) return false;
    if (!includeArchived && folder.archived_at) return false;
    return true;
  });
}

async function getMediaFolderById(id: string): Promise<MediaFolder> {
  const folder = readMediaFolders().find((f) => f.id === id);
  if (!folder) throw new NotFoundError(`Media folder ${id} was not found`);
  return folder;
}

async function createMediaFolder(input: MediaFolderInput): Promise<DataResult<MediaFolder>> {
  if (!input.name.trim()) {
    return fail("Please fix the highlighted fields.", { name: "Folder name is required." });
  }

  if (input.parentFolderId) {
    const parent = readMediaFolders().find((f) => f.id === input.parentFolderId);
    if (!parent) return fail("Parent folder not found.");
    if ((input.ownerType ?? null) !== parent.owner_type || (input.ownerId ?? null) !== parent.owner_id) {
      return fail("Please fix the highlighted fields.", { parentFolderId: "Sub-folders must share the same owner as their parent." });
    }
  }

  const timestamp = nowIso();
  const folder: MediaFolder = {
    id: generateId("mediafolder"),
    workspace_id: CURRENT_WORKSPACE_ID,
    owner_type: input.ownerType ?? null,
    owner_id: input.ownerId ?? null,
    parent_folder_id: input.parentFolderId ?? null,
    name: input.name.trim(),
    sort_order: input.sortOrder ?? 0,
    created_by: CURRENT_WORKSPACE_ID,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeMediaFolders([...readMediaFolders(), folder]);
  recordTimelineActivity(folder.workspace_id, "media_folder", folder.id, "media_folder_created", `Folder created: "${folder.name}"`);
  return ok(folder);
}

async function updateMediaFolder(id: string, input: MediaFolderUpdateInput): Promise<DataResult<MediaFolder>> {
  const existing = readMediaFolders().find((f) => f.id === id);
  if (!existing) return fail("Folder not found.");
  if (input.name !== undefined && !input.name.trim()) {
    return fail("Please fix the highlighted fields.", { name: "Folder name is required." });
  }

  const updated: MediaFolder = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    sort_order: input.sortOrder ?? existing.sort_order,
    updated_at: nowIso(),
  };
  writeMediaFolders(readMediaFolders().map((f) => (f.id === id ? updated : f)));
  return ok(updated);
}

async function moveMediaFolder(id: string, newParentFolderId: string | null): Promise<DataResult<MediaFolder>> {
  const existing = readMediaFolders().find((f) => f.id === id);
  if (!existing) return fail("Folder not found.");

  const check = canMoveFolder(existing, newParentFolderId, readMediaFolders());
  if (!check.allowed) return fail(check.reason ?? "This folder cannot be moved there.");

  const updated: MediaFolder = { ...existing, parent_folder_id: newParentFolderId, updated_at: nowIso() };
  writeMediaFolders(readMediaFolders().map((f) => (f.id === id ? updated : f)));
  recordTimelineActivity(existing.workspace_id, "media_folder", id, "media_folder_moved", `Folder moved: "${existing.name}"`);
  return ok(updated);
}

async function archiveMediaFolder(id: string): Promise<DataResult<MediaFolder>> {
  const existing = readMediaFolders().find((f) => f.id === id);
  if (!existing) return fail("Folder not found.");
  if (existing.archived_at) return fail("This folder is already archived.");

  const timestamp = nowIso();
  const updated: MediaFolder = { ...existing, archived_at: timestamp, updated_at: timestamp };
  writeMediaFolders(readMediaFolders().map((f) => (f.id === id ? updated : f)));
  return ok(updated);
}

async function restoreMediaFolder(id: string): Promise<DataResult<MediaFolder>> {
  const existing = readMediaFolders().find((f) => f.id === id);
  if (!existing) return fail("Folder not found.");
  if (!existing.archived_at) return fail("This folder is not archived.");

  const updated: MediaFolder = { ...existing, archived_at: null, updated_at: nowIso() };
  writeMediaFolders(readMediaFolders().map((f) => (f.id === id ? updated : f)));
  return ok(updated);
}

// Checkpoint 25, Steps 3 & 14 — Collections & Collections Intelligence

async function getMediaCollections(): Promise<MediaCollection[]> {
  return readMediaCollections().filter((c) => c.workspace_id === CURRENT_WORKSPACE_ID);
}

async function getMediaCollectionById(id: string): Promise<MediaCollection> {
  const collection = readMediaCollections().find((c) => c.id === id);
  if (!collection) throw new NotFoundError(`Media collection ${id} was not found`);
  return collection;
}

async function createMediaCollection(input: MediaCollectionInput): Promise<DataResult<MediaCollection>> {
  if (!input.name.trim()) {
    return fail("Please fix the highlighted fields.", { name: "Collection name is required." });
  }

  const timestamp = nowIso();
  const collection: MediaCollection = {
    id: generateId("mediacollection"),
    workspace_id: CURRENT_WORKSPACE_ID,
    name: input.name.trim(),
    description: input.description ?? null,
    kind: input.kind ?? "manual",
    template: input.template ?? null,
    asset_ids: [],
    smart_rule: input.smartRule ?? null,
    is_favorite: false,
    is_pinned: false,
    shared_with_member_ids: [],
    created_by: CURRENT_WORKSPACE_ID,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writeMediaCollections([...readMediaCollections(), collection]);
  recordTimelineActivity(collection.workspace_id, "media_collection", collection.id, "media_collection_created", `Collection created: "${collection.name}"`);
  return ok(collection);
}

async function updateMediaCollection(id: string, input: MediaCollectionUpdateInput): Promise<DataResult<MediaCollection>> {
  const existing = readMediaCollections().find((c) => c.id === id);
  if (!existing) return fail("Collection not found.");
  if (input.name !== undefined && !input.name.trim()) {
    return fail("Please fix the highlighted fields.", { name: "Collection name is required." });
  }

  const updated: MediaCollection = {
    ...existing,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    description: input.description !== undefined ? input.description : existing.description,
    smart_rule: input.smartRule !== undefined ? input.smartRule : existing.smart_rule,
    updated_at: nowIso(),
  };
  writeMediaCollections(readMediaCollections().map((c) => (c.id === id ? updated : c)));
  return ok(updated);
}

async function deleteMediaCollection(id: string): Promise<DataResult<MediaCollection>> {
  const existing = readMediaCollections().find((c) => c.id === id);
  if (!existing) return fail("Collection not found.");
  writeMediaCollections(readMediaCollections().filter((c) => c.id !== id));
  return ok(existing);
}

async function addAssetToCollection(collectionId: string, assetId: string): Promise<DataResult<MediaCollection>> {
  const existing = readMediaCollections().find((c) => c.id === collectionId);
  if (!existing) return fail("Collection not found.");
  const asset = readMediaAssets().find((a) => a.id === assetId);
  if (!asset) return fail("Media asset not found.");
  if (existing.asset_ids.includes(assetId)) return ok(existing);

  const updated: MediaCollection = { ...existing, asset_ids: [...existing.asset_ids, assetId], updated_at: nowIso() };
  writeMediaCollections(readMediaCollections().map((c) => (c.id === collectionId ? updated : c)));
  recordTimelineActivity(
    existing.workspace_id,
    "media_asset",
    assetId,
    "media_asset_added_to_collection",
    `"${asset.original_filename}" added to collection "${existing.name}"`,
  );
  // Step 10 — membership is a real graph edge (source: the asset, since it's the thing "included in" the collection), not tracked only in `asset_ids`. Impact Analysis's "which collections include this asset" (Step 10.8) traverses this edge, not the collection's own array.
  await mockKnowledgeGraphRepository.createRelationship(existing.workspace_id, "system", {
    sourceNodeType: "media_asset",
    sourceNodeId: assetId,
    targetNodeType: "media_collection",
    targetNodeId: collectionId,
    relationshipType: "included_in",
    source: "user_action",
  });
  return ok(updated);
}

async function removeAssetFromCollection(collectionId: string, assetId: string): Promise<DataResult<MediaCollection>> {
  const existing = readMediaCollections().find((c) => c.id === collectionId);
  if (!existing) return fail("Collection not found.");
  const asset = readMediaAssets().find((a) => a.id === assetId);

  const updated: MediaCollection = { ...existing, asset_ids: existing.asset_ids.filter((id) => id !== assetId), updated_at: nowIso() };
  writeMediaCollections(readMediaCollections().map((c) => (c.id === collectionId ? updated : c)));
  if (asset) {
    recordTimelineActivity(
      existing.workspace_id,
      "media_asset",
      assetId,
      "media_asset_removed_from_collection",
      `"${asset.original_filename}" removed from collection "${existing.name}"`,
    );
  }

  const inclusionEdge = (await mockKnowledgeGraphRepository.listRelationshipsForWorkspace(existing.workspace_id)).find(
    (r) => r.relationship_type === "included_in" && r.source_node_type === "media_asset" && r.source_node_id === assetId && r.target_node_type === "media_collection" && r.target_node_id === collectionId,
  );
  if (inclusionEdge) await mockKnowledgeGraphRepository.removeRelationship(inclusionEdge.id, existing.workspace_id);

  return ok(updated);
}

async function toggleMediaCollectionFavorite(id: string): Promise<DataResult<MediaCollection>> {
  const existing = readMediaCollections().find((c) => c.id === id);
  if (!existing) return fail("Collection not found.");
  const updated: MediaCollection = { ...existing, is_favorite: !existing.is_favorite, updated_at: nowIso() };
  writeMediaCollections(readMediaCollections().map((c) => (c.id === id ? updated : c)));
  return ok(updated);
}

async function toggleMediaCollectionPinned(id: string): Promise<DataResult<MediaCollection>> {
  const existing = readMediaCollections().find((c) => c.id === id);
  if (!existing) return fail("Collection not found.");
  const updated: MediaCollection = { ...existing, is_pinned: !existing.is_pinned, updated_at: nowIso() };
  writeMediaCollections(readMediaCollections().map((c) => (c.id === id ? updated : c)));
  return ok(updated);
}

export const mockMediaAssetsRepository: MediaAssetsRepository = {
  getMediaAssetById,
  getMediaAssetsByOwner,
  listMediaAssetsForWorkspace,
  uploadMediaAsset,
  replaceMediaAssetVersion,
  downloadMediaAsset,
  getMediaAssetDownloadUrl,
  verifyMediaAssetChecksum,
  deleteMediaAsset,
  restoreMediaAsset,
  setMediaAssetFolder,
  setMediaAssetTags,
  setMediaAssetColorLabel,
  setMediaAssetPriority,
  setMediaAssetAiReady,
  updateMediaAssetMetadata,
  setMediaAssetStatus,
  getMediaFolders,
  getMediaFolderById,
  createMediaFolder,
  updateMediaFolder,
  moveMediaFolder,
  archiveMediaFolder,
  restoreMediaFolder,
  getMediaCollections,
  getMediaCollectionById,
  createMediaCollection,
  updateMediaCollection,
  deleteMediaCollection,
  addAssetToCollection,
  removeAssetFromCollection,
  toggleMediaCollectionFavorite,
  toggleMediaCollectionPinned,
};
