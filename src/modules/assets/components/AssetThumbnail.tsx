"use client";

import { useEffect, useState } from "react";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import type { MediaAsset } from "@/types/mediaAsset";
import { categorizeAsset, ASSET_CATEGORY_LABELS } from "@/modules/assets/assetCategory";

interface AssetThumbnailProps {
  asset: MediaAsset;
  /** "card" = grid tile (cropped, aspect-square). "hero" = detail page (full media, preserved aspect, no crop). */
  variant?: "card" | "hero";
  className?: string;
}

/**
 * Renders the real uploaded file inline for previewable categories
 * (image/video/audio), fetched via the same `getMediaAssetDownloadUrl`
 * signed-URL mechanism the Download button already uses — never a
 * synthetic/generated thumbnail (no such pipeline exists; see
 * `previewEngine.ts`'s own `thumbnailAvailable: false`). Falls back to the
 * existing category-label tile for non-previewable types, for a failed/slow
 * load, and for mock mode (where the download URL is a placeholder
 * `mock://` scheme a browser can't render).
 */
export function AssetThumbnail({ asset, variant = "card", className = "" }: AssetThumbnailProps) {
  const category = categorizeAsset(asset);
  const previewable = category === "image" || category === "video";
  const [resolved, setResolved] = useState<{ forAssetId: string; url: string | null; failed: boolean } | null>(null);

  useEffect(() => {
    if (!previewable) return;
    let cancelled = false;
    getMediaAssetDownloadUrl(asset.id).then((result) => {
      if (cancelled) return;
      if (result.success && result.data.url.startsWith("http")) {
        setResolved({ forAssetId: asset.id, url: result.data.url, failed: false });
      } else {
        setResolved({ forAssetId: asset.id, url: null, failed: true });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [asset.id, previewable]);

  const current = resolved?.forAssetId === asset.id ? resolved : null;
  const url = current?.url ?? null;
  const failed = current?.failed ?? false;

  const frameClass =
    variant === "card"
      ? `flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-tint ${className}`
      : `flex max-h-[28rem] w-full items-center justify-center overflow-hidden rounded-lg bg-surface-tint ${className}`;

  if (previewable && url && !failed) {
    if (category === "image") {
      return (
        <div className={frameClass}>
          {/* eslint-disable-next-line @next/next/no-img-element -- real signed Supabase Storage URL, not a static asset Next can optimize */}
          <img
            src={url}
            alt={asset.original_filename}
            onError={() => setResolved({ forAssetId: asset.id, url: null, failed: true })}
            className={variant === "card" ? "h-full w-full object-cover" : "max-h-[28rem] w-auto object-contain"}
          />
        </div>
      );
    }
    return (
      <div className={frameClass}>
        <video
          src={url}
          controls={variant === "hero"}
          muted
          onError={() => setResolved({ forAssetId: asset.id, url: null, failed: true })}
          className={variant === "card" ? "h-full w-full object-cover" : "max-h-[28rem] w-auto object-contain"}
        />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{ASSET_CATEGORY_LABELS[category]}</span>
    </div>
  );
}
