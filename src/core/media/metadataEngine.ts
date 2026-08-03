import type { MediaAsset } from "@/types/mediaAsset";

/**
 * v2.0 Checkpoint 25, Step 4 — Metadata Engine. Dimensions/Size/FileType are
 * already stored fields on `MediaAsset`; AspectRatio/Orientation are always
 * derivable from `width`/`height` and therefore never stored redundantly —
 * same "derive, don't duplicate" discipline as `assetCategory.ts`.
 */

export type AssetOrientation = "landscape" | "portrait" | "square";

/** Simplified ratio (e.g. "16:9") via GCD reduction, or `null` when either dimension is missing. */
export function computeAspectRatio(asset: Pick<MediaAsset, "width" | "height">): string | null {
  if (!asset.width || !asset.height) return null;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(asset.width, asset.height);
  return `${asset.width / divisor}:${asset.height / divisor}`;
}

export function computeOrientation(asset: Pick<MediaAsset, "width" | "height">): AssetOrientation | null {
  if (!asset.width || !asset.height) return null;
  if (asset.width === asset.height) return "square";
  return asset.width > asset.height ? "landscape" : "portrait";
}
