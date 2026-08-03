/**
 * Extension points, not a pipeline — no image-processing library is
 * installed in this project, and adding one is out of scope for "storage
 * layer only." Both functions fail soft: a missing/unsupported environment
 * (e.g. a Node test runner without `createImageBitmap`) or a corrupt image
 * never blocks an upload, it just skips the enrichment.
 */

export interface ImageDimensions {
  width: number;
  height: number;
}

export async function detectImageDimensions(file: Blob, mimeType: string): Promise<ImageDimensions | null> {
  if (!mimeType.startsWith("image/")) return null;
  if (typeof createImageBitmap !== "function") return null;

  try {
    const bitmap = await createImageBitmap(file);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return dimensions;
  } catch {
    return null;
  }
}

export interface ImageOptimizationResult {
  bytes: Blob;
  mimeType: string;
}

/**
 * Hook for future image optimization (resize/compress/convert to webp,
 * likely via a Supabase Storage image transformation or an edge function).
 * Always returns null today so uploadMediaAsset falls back to the original
 * file untouched until real optimization is wired up.
 */
export async function optimizeImage(file: Blob, mimeType: string): Promise<ImageOptimizationResult | null> {
  void file;
  void mimeType;
  return null;
}
