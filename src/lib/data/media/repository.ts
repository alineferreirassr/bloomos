import type { MediaAsset, MediaAssetMetadata } from "@/types/mediaAsset";
import type { EntityType } from "@/core/enums/entityType";
import type { MediaAssetStatus } from "@/core/enums/mediaAssetStatus";
import type { MediaFolder } from "@/types/mediaFolder";
import type { MediaCollection, MediaCollectionKind, MediaCollectionTemplate, SmartCollectionRule } from "@/types/mediaCollection";
import type { DataResult } from "@/lib/data/result";

export interface MediaAssetFilters {
  includeArchived?: boolean;
}

export interface UploadMediaAssetInput {
  ownerType: EntityType;
  ownerId: string;
  file: Blob;
  originalFilename: string;
  /** Overrides file.type when the caller already knows a more accurate MIME type (browsers sometimes report an empty/generic type). */
  mimeType?: string;
  /** Checkpoint 25, Step 3 — files the Asset Library. `null`/omitted means unfiled, not an error. */
  folderId?: string | null;
}

export interface ReplaceMediaAssetVersionInput {
  file: Blob;
  originalFilename: string;
  mimeType?: string;
  /** Checkpoint 25, Step 8 — Version Notes for this specific replacement. */
  versionNotes?: string | null;
}

export interface MediaAssetDownload {
  blob: Blob;
  mediaAsset: MediaAsset;
}

export interface MediaAssetDownloadUrl {
  url: string;
  expiresAt: string;
}

export interface MediaAssetChecksumVerification {
  valid: boolean;
  expectedChecksum: string;
  actualChecksum: string;
}

/** Checkpoint 25, Step 3 — Folders. `ownerType`/`ownerId` both omitted or `null` means a workspace-wide folder (the common Asset Library case); a folder never changes owner after creation, matching `DocumentFolder`'s own rule. */
export interface MediaFolderInput {
  ownerType?: EntityType | null;
  ownerId?: string | null;
  parentFolderId?: string | null;
  name: string;
  sortOrder?: number;
}

export interface MediaFolderUpdateInput {
  name?: string;
  sortOrder?: number;
}

export interface MediaFolderFilters {
  ownerType?: EntityType | null;
  ownerId?: string | null;
  parentFolderId?: string | null;
  includeArchived?: boolean;
}

/** Checkpoint 25, Steps 3 & 14 — Collections & Collections Intelligence. */
export interface MediaCollectionInput {
  name: string;
  description?: string | null;
  kind?: MediaCollectionKind;
  template?: MediaCollectionTemplate | null;
  smartRule?: SmartCollectionRule | null;
}

export interface MediaCollectionUpdateInput {
  name?: string;
  description?: string | null;
  smartRule?: SmartCollectionRule | null;
}

/**
 * The single Media Library persistence contract — implemented once by the
 * mock repository (lib/data/media/mockRepository.ts) and once by the
 * Supabase repository (lib/data/media/supabaseRepository.ts), exactly
 * mirroring the Leads/Clients/Events repository pattern. lib/data/index.ts
 * picks between them via lib/data/provider.ts's selectRepository().
 *
 * This is infrastructure only — it knows nothing about Documents, Contracts,
 * Finance, Knowledge Base, Notifications, or Automation. Every current and
 * future module attaches files through this same interface via
 * owner_type/owner_id; see src/lib/media/ownerTypes.ts for the full planned
 * owner-type set versus what's live today.
 */
export interface MediaAssetsRepository {
  getMediaAssetById(id: string): Promise<MediaAsset>;
  getMediaAssetsByOwner(ownerType: EntityType, ownerId: string, filters?: MediaAssetFilters): Promise<MediaAsset[]>;
  /** Checkpoint 25 — every asset in a workspace, for the Asset Library grid (which is not scoped to any one owner). */
  listMediaAssetsForWorkspace(workspaceId: string, filters?: MediaAssetFilters): Promise<MediaAsset[]>;
  uploadMediaAsset(input: UploadMediaAssetInput): Promise<DataResult<MediaAsset>>;
  replaceMediaAssetVersion(id: string, input: ReplaceMediaAssetVersionInput): Promise<DataResult<MediaAsset>>;
  downloadMediaAsset(id: string): Promise<DataResult<MediaAssetDownload>>;
  getMediaAssetDownloadUrl(id: string, expiresInSeconds?: number): Promise<DataResult<MediaAssetDownloadUrl>>;
  verifyMediaAssetChecksum(id: string): Promise<DataResult<MediaAssetChecksumVerification>>;
  deleteMediaAsset(id: string): Promise<DataResult<MediaAsset>>;
  restoreMediaAsset(id: string): Promise<DataResult<MediaAsset>>;
  /** Checkpoint 25, Step 3 — moves an asset into a folder (or `null` to unfile it). */
  setMediaAssetFolder(id: string, folderId: string | null): Promise<DataResult<MediaAsset>>;
  /** Checkpoint 25, Step 5 — Tagging System. Replaces the full tag set (the UI always sends the complete intended list, matching every other tag editor in this codebase). */
  setMediaAssetTags(id: string, tags: string[]): Promise<DataResult<MediaAsset>>;
  setMediaAssetColorLabel(id: string, colorLabel: string | null): Promise<DataResult<MediaAsset>>;
  setMediaAssetPriority(id: string, priority: "low" | "normal" | "high" | null): Promise<DataResult<MediaAsset>>;
  setMediaAssetAiReady(id: string, aiReady: boolean): Promise<DataResult<MediaAsset>>;
  /** Checkpoint 25, Step 4 — Metadata Engine. Merges into the existing `metadata` object (never a full-replace, so one field editor never clobbers another). */
  updateMediaAssetMetadata(id: string, patch: Partial<MediaAssetMetadata>): Promise<DataResult<MediaAsset>>;
  /** Checkpoint 25, Step 9 — Approval Workflow. */
  /** Step 10.6/10 — `actorMemberId`, when given, records a real `approved_by`/`rejected_by` Knowledge Graph edge from that team member to the asset (`actor` alone is a display string, not a node id). */
  setMediaAssetStatus(id: string, status: MediaAssetStatus, actor: string, rejectionReason?: string | null, actorMemberId?: string | null): Promise<DataResult<MediaAsset>>;

  // Checkpoint 25, Step 3 — Folders
  getMediaFolders(filters?: MediaFolderFilters): Promise<MediaFolder[]>;
  getMediaFolderById(id: string): Promise<MediaFolder>;
  createMediaFolder(input: MediaFolderInput): Promise<DataResult<MediaFolder>>;
  updateMediaFolder(id: string, input: MediaFolderUpdateInput): Promise<DataResult<MediaFolder>>;
  moveMediaFolder(id: string, newParentFolderId: string | null): Promise<DataResult<MediaFolder>>;
  archiveMediaFolder(id: string): Promise<DataResult<MediaFolder>>;
  restoreMediaFolder(id: string): Promise<DataResult<MediaFolder>>;

  // Checkpoint 25, Steps 3 & 14 — Collections & Collections Intelligence
  getMediaCollections(): Promise<MediaCollection[]>;
  getMediaCollectionById(id: string): Promise<MediaCollection>;
  createMediaCollection(input: MediaCollectionInput): Promise<DataResult<MediaCollection>>;
  updateMediaCollection(id: string, input: MediaCollectionUpdateInput): Promise<DataResult<MediaCollection>>;
  deleteMediaCollection(id: string): Promise<DataResult<MediaCollection>>;
  addAssetToCollection(collectionId: string, assetId: string): Promise<DataResult<MediaCollection>>;
  removeAssetFromCollection(collectionId: string, assetId: string): Promise<DataResult<MediaCollection>>;
  toggleMediaCollectionFavorite(id: string): Promise<DataResult<MediaCollection>>;
  toggleMediaCollectionPinned(id: string): Promise<DataResult<MediaCollection>>;
}
