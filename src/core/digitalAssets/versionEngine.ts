import type { MediaAsset } from "@/types/mediaAsset";
import type { AssetSnapshot, AssetVersion } from "@/types/digitalAssets";
import { generateId } from "@/lib/data/utils";

/**
 * v2.0 Checkpoint 37, Step 4 — Version Engine. `replaceMediaAssetVersion`
 * (the real repository action, Checkpoint 25) mutates the `MediaAsset` row
 * in place — it has no history of its own. This engine is pure/testable:
 * it builds the `AssetVersion` snapshot a caller should persist *before*
 * calling the real replace, and answers read-only questions about a
 * version list already assembled from `assetVersionsStore` + the live
 * asset. The actual store write happens in
 * `modules/digitalAssets/digitalAssetsActions.ts`'s `createAssetVersionAction`
 * — this module never touches persistence itself, the same
 * engine/module-layer split every other Platform in this codebase holds to.
 */

/** Freezes the file-descriptor fields `replaceMediaAssetVersion` is about to overwrite. */
export function snapshotFromAsset(asset: MediaAsset): AssetSnapshot {
  return {
    original_filename: asset.original_filename,
    storage_path: asset.storage_path,
    mime_type: asset.mime_type,
    extension: asset.extension,
    file_size: asset.file_size,
    checksum: asset.checksum,
    width: asset.width,
    height: asset.height,
    duration: asset.duration,
    metadata: asset.metadata,
  };
}

/** Builds the `AssetVersion` row to persist for the asset's *current* (about-to-be-superseded) version, right before a replace happens. */
export function buildOutgoingVersion(asset: MediaAsset, workspaceId: string): AssetVersion {
  return {
    id: generateId("assetversion"),
    workspace_id: workspaceId,
    asset_id: asset.id,
    version: asset.version,
    snapshot: snapshotFromAsset(asset),
    version_notes: asset.version_notes,
    created_by: asset.uploaded_by,
    captured_at: new Date().toISOString(),
  };
}

/** The next version number `replaceMediaAssetVersion` will assign — exposed for display/validation only; the real repository owns the actual increment. */
export function nextVersionNumber(asset: MediaAsset): number {
  return asset.version + 1;
}

/** Every version this asset has ever had, current first — the stored history plus a synthetic entry for the still-live current version (which has no `AssetVersion` row of its own since it hasn't been superseded yet). */
export function fullVersionHistory(asset: MediaAsset, storedVersions: AssetVersion[]): AssetVersion[] {
  const currentAsVersion: AssetVersion = {
    id: `current:${asset.id}`,
    workspace_id: asset.workspace_id,
    asset_id: asset.id,
    version: asset.version,
    snapshot: snapshotFromAsset(asset),
    version_notes: asset.version_notes,
    created_by: asset.uploaded_by,
    captured_at: asset.updated_at,
  };
  const history = storedVersions.filter((version) => version.asset_id === asset.id);
  return [currentAsVersion, ...history].sort((a, b) => b.version - a.version);
}

export function latestVersion(asset: MediaAsset, storedVersions: AssetVersion[]): AssetVersion {
  return fullVersionHistory(asset, storedVersions)[0];
}

export interface MetadataFieldDiff {
  field: string;
  from: string | null;
  to: string | null;
  changed: boolean;
}

/** Field-by-field comparison between two snapshots' metadata — deterministic, no fuzzy matching. Every `MediaAssetMetadata` field plus the core descriptor fields (size/dimensions/duration/checksum) are compared. */
export function compareVersionMetadata(a: AssetSnapshot, b: AssetSnapshot): MetadataFieldDiff[] {
  const stringify = (value: unknown): string | null => (value === null || value === undefined ? null : typeof value === "object" ? JSON.stringify(value) : String(value));

  const fields: [string, unknown, unknown][] = [
    ["file_size", a.file_size, b.file_size],
    ["width", a.width, b.width],
    ["height", a.height, b.height],
    ["duration", a.duration, b.duration],
    ["checksum", a.checksum, b.checksum],
    ["mime_type", a.mime_type, b.mime_type],
    ["pages", a.metadata.pages, b.metadata.pages],
    ["author", a.metadata.author, b.metadata.author],
    ["license", a.metadata.license, b.metadata.license],
    ["brand", a.metadata.brand, b.metadata.brand],
    ["colorProfile", a.metadata.colorProfile, b.metadata.colorProfile],
    ["location", a.metadata.location, b.metadata.location],
  ];

  return fields.map(([field, from, to]) => ({
    field,
    from: stringify(from),
    to: stringify(to),
    changed: stringify(from) !== stringify(to),
  }));
}

export interface RestorePlaceholderResult {
  supported: false;
  message: string;
}

/**
 * "Restore placeholder" (spec) — restoring a prior version would mean
 * re-uploading its exact bytes as a brand-new current version, which needs
 * the original `Blob` this checkpoint's own stop condition (no real file
 * upload beyond what Checkpoint 25 already built) doesn't reach for a
 * *historical* version's bytes (only the live blob store keeps the current
 * one). Disclosed as an inert placeholder rather than a fabricated restore.
 */
export function restoreVersionPlaceholder(_version: AssetVersion): RestorePlaceholderResult {
  return { supported: false, message: "Restoring a previous version isn't available yet — download it and re-upload manually if you need its exact bytes back." };
}
