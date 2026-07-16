import type { MediaAsset } from "@/types/mediaAsset";
import type { EntityType } from "@/core/enums/entityType";
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
}

export interface ReplaceMediaAssetVersionInput {
  file: Blob;
  originalFilename: string;
  mimeType?: string;
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
  uploadMediaAsset(input: UploadMediaAssetInput): Promise<DataResult<MediaAsset>>;
  replaceMediaAssetVersion(id: string, input: ReplaceMediaAssetVersionInput): Promise<DataResult<MediaAsset>>;
  downloadMediaAsset(id: string): Promise<DataResult<MediaAssetDownload>>;
  getMediaAssetDownloadUrl(id: string, expiresInSeconds?: number): Promise<DataResult<MediaAssetDownloadUrl>>;
  verifyMediaAssetChecksum(id: string): Promise<DataResult<MediaAssetChecksumVerification>>;
  deleteMediaAsset(id: string): Promise<DataResult<MediaAsset>>;
  restoreMediaAsset(id: string): Promise<DataResult<MediaAsset>>;
}
