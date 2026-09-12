"use client";

import { useEffect, useState } from "react";
import { getMediaAssetDownloadUrl } from "@/lib/data";
import { INSPIRATION_SOURCE_TYPE_LABELS } from "@/modules/inspiration/labels";
import type { InspirationSourceType } from "@/types/inspirationItem";

interface InspirationThumbnailProps {
  mediaAssetId: string | null;
  sourceType: InspirationSourceType;
  title: string;
  className?: string;
}

/**
 * SOCIAL-06D — mirrors `AssetThumbnail`/`SocialAnalyticsView`'s own
 * `PostThumbnail` signed-URL pattern exactly: the ONLY safe preview
 * mechanism for a `media_asset_id` is `getMediaAssetDownloadUrl`, fetched
 * client-side per card. Never stores/fetches an external thumbnail URL,
 * never scrapes OpenGraph, never hotlinks arbitrary creator media — a
 * reference with no MediaAsset (or a failed/slow load) always falls back to
 * a plain source-type label tile, never a broken-image state.
 */
export function InspirationThumbnail({ mediaAssetId, sourceType, title, className = "" }: InspirationThumbnailProps) {
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
  const frameClass = `flex aspect-square w-full items-center justify-center overflow-hidden rounded-md bg-surface-tint ${className}`;

  if (url) {
    return (
      <div className={frameClass}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a real signed Supabase Storage URL, not a static asset Next can optimize */}
        <img
          src={url}
          alt={title}
          onError={() => setResolved({ forAssetId: mediaAssetId as string, url: null })}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={frameClass}>
      <span className="text-xs font-medium uppercase tracking-wide text-text-muted">{INSPIRATION_SOURCE_TYPE_LABELS[sourceType]}</span>
    </div>
  );
}
