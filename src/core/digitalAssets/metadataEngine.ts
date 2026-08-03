import type { MediaAsset } from "@/types/mediaAsset";
import { computeAspectRatio, computeOrientation, type AssetOrientation } from "@/core/media/metadataEngine";
import { formatBytes } from "@/modules/documents/mappers";

/**
 * v2.0 Checkpoint 37, Step 7 — Metadata Engine. Every field the spec names
 * (file size, dimensions, duration, page count, mime type, extension,
 * checksum, created/updated) is already a real, stored field on
 * `MediaAsset` (Checkpoint 25) — this is a presentation/composition layer
 * over those fields for the Asset Detail page's own Metadata section, not
 * a second place any of them get computed or stored. Aspect
 * ratio/orientation are reused directly from `core/media/metadataEngine.ts`
 * rather than re-derived.
 */
export interface AssetMetadataSummary {
  fileSizeLabel: string;
  dimensionsLabel: string | null;
  aspectRatio: string | null;
  orientation: AssetOrientation | null;
  durationLabel: string | null;
  pageCount: number | null;
  mimeType: string;
  extension: string;
  checksum: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  /** True once every field a *deterministically applicable* metadata check can fill in is present — see `isMetadataComplete`'s own doc comment for exactly what's checked and why duration/dimensions are conditional. */
  isComplete: boolean;
}

function formatDuration(seconds: number | null): string | null {
  if (seconds === null) return null;
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60);
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

function formatDateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/**
 * "Missing Metadata" (the Health Engine's own Step 10 issue type) needs one
 * deterministic yes/no answer. A field only counts against completeness
 * when it's *applicable* to this asset's own preview type — an audio file
 * with `width: null` isn't missing anything, since audio has no
 * dimensions. Applicable checks: `original_filename` is never empty
 * (repository-enforced, so this always passes — kept explicit for
 * clarity), `metadata.author` is set, and — only for image/video assets —
 * `width`/`height` are both set.
 */
export function isMetadataComplete(asset: MediaAsset, previewType: "image" | "video" | "audio" | "pdf" | "text" | "spreadsheet" | "presentation" | "document" | "unknown"): boolean {
  if (!asset.original_filename.trim()) return false;
  if (!asset.metadata.author) return false;
  if ((previewType === "image" || previewType === "video") && (asset.width === null || asset.height === null)) return false;
  return true;
}

export function summarizeAssetMetadata(asset: MediaAsset, previewType: Parameters<typeof isMetadataComplete>[1]): AssetMetadataSummary {
  return {
    fileSizeLabel: formatBytes(asset.file_size),
    dimensionsLabel: asset.width && asset.height ? `${asset.width} × ${asset.height}` : null,
    aspectRatio: computeAspectRatio(asset),
    orientation: computeOrientation(asset),
    durationLabel: formatDuration(asset.duration),
    pageCount: asset.metadata.pages,
    mimeType: asset.mime_type,
    extension: asset.extension,
    checksum: asset.checksum,
    createdAtLabel: formatDateLabel(asset.created_at),
    updatedAtLabel: formatDateLabel(asset.updated_at),
    isComplete: isMetadataComplete(asset, previewType),
  };
}
