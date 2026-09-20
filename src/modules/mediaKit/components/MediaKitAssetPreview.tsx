"use client";

import { useEffect, useState } from "react";
import { getMediaAssetDownloadUrl } from "@/lib/data";

interface MediaKitAssetPreviewProps {
  mediaAssetId: string | null;
  title: string;
  className?: string;
}

/**
 * MEDIAKIT-04 — mirrors `CarouselSlideMediaPreview.tsx`'s own signed-URL
 * pattern exactly (this codebase's established per-domain-copy convention
 * for this exact preview shape, private/authenticated context only): the
 * ONLY safe preview mechanism for a `media_asset_id` here is
 * `getMediaAssetDownloadUrl`, fetched client-side per render under the
 * founder's own authenticated session. A null id or a failed/slow load
 * always falls back to a plain "No image" tile, never a broken-image icon.
 */
export function MediaKitAssetPreview({ mediaAssetId, title, className = "" }: MediaKitAssetPreviewProps) {
  const [resolved, setResolved] = useState<{ forAssetId: string; url: string | null } | null>(null);

  useEffect(() => {
    if (!mediaAssetId) return;
    let cancelled = false;
    getMediaAssetDownloadUrl(mediaAssetId).then((result) => {
      if (cancelled) return;
      setResolved({ forAssetId: mediaAssetId, url: result.success && result.data.url.startsWith("http") ? result.data.url : null });
    });
    return () => {
      cancelled = true;
    };
  }, [mediaAssetId]);

  const current = mediaAssetId && resolved?.forAssetId === mediaAssetId ? resolved : null;
  const url = current?.url ?? null;
  const frameClass = `flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-[0.625rem] bg-surface-tint ${className}`;

  if (url) {
    return (
      <div className={frameClass}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL, not a static asset Next can optimize */}
        <img src={url} alt={title} onError={() => setResolved({ forAssetId: mediaAssetId as string, url: null })} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <span className="text-xs font-medium tracking-wide text-text-muted uppercase">No image</span>
    </div>
  );
}
