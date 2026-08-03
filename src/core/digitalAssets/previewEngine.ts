import type { MediaAsset } from "@/types/mediaAsset";
import type { AssetPreview, PreviewType } from "@/types/digitalAssets";
import { categorizeAsset } from "@/modules/assets/assetCategory";

/**
 * v2.0 Checkpoint 37, Step 6 — Preview Engine. "Never render actual files.
 * Only determine preview behavior" (spec) — this is a pure classification
 * function, never a thumbnail generator or embedded viewer. Reuses
 * `categorizeAsset` (Checkpoint 25's own mime/extension categorization,
 * `modules/assets/assetCategory.ts`) as the one source of truth for "what
 * kind of file is this" rather than re-deriving it from mime/extension a
 * second time — `PreviewType` only regroups those same categories into the
 * spec's own named preview buckets (e.g. `AssetCategory`'s "document" maps
 * to `PreviewType`'s "document" or "text" depending on extension;
 * "archive"/"3d" have no dedicated preview behavior and fall to
 * "unknown").
 */
const TEXT_EXTENSIONS = new Set(["txt", "md", "csv", "json", "log"]);

export function resolvePreviewType(asset: Pick<MediaAsset, "mime_type" | "extension">): PreviewType {
  const category = categorizeAsset(asset);
  const ext = asset.extension.toLowerCase();

  switch (category) {
    case "image":
      return "image";
    case "video":
      return "video";
    case "audio":
      return "audio";
    case "pdf":
      return "pdf";
    case "spreadsheet":
      return "spreadsheet";
    case "presentation":
      return "presentation";
    case "document":
      return TEXT_EXTENSIONS.has(ext) || asset.mime_type === "text/plain" ? "text" : "document";
    case "archive":
    case "3d":
    case "other":
    default:
      return "unknown";
  }
}

/** Preview types this checkpoint considers safe to render inline in a browser tab without a dedicated viewer plugin — image/PDF/video/audio/text all have native browser support; the document/spreadsheet/presentation formats this app actually stores (docx/xlsx/pptx) do not. */
const INLINE_RENDERABLE: ReadonlySet<PreviewType> = new Set(["image", "pdf", "video", "audio", "text"]);

export function buildAssetPreview(asset: MediaAsset): AssetPreview {
  const previewType = resolvePreviewType(asset);
  return {
    assetId: asset.id,
    previewType,
    canRenderInline: INLINE_RENDERABLE.has(previewType),
    // No thumbnail-generation pipeline exists or is in scope this checkpoint (the spec's own stop condition forbids image processing) — always false, a disclosed limitation, never a fabricated capability.
    thumbnailAvailable: false,
  };
}
