"use client";

import { useEffect, useState } from "react";
import { evaluatePlatformAction, type PlatformEvaluation } from "@/modules/digitalAssets/digitalAssetsActions";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatBytes } from "@/modules/documents/mappers";

const HEALTH_BAND_TONE: Record<string, BadgeTone> = { excellent: "success", good: "success", attention: "warning", critical: "danger" };

/**
 * v2.0 Checkpoint 37, Step 17 — the Asset Library Dashboard's own new
 * summary strip: Storage KPIs, Platform Health, and Analytics highlights,
 * every value from `evaluatePlatformAction()` (this checkpoint's own
 * Health/Analytics Engines). Rendered above the existing
 * search/filter/grid — this is an extension of the one real Asset Library
 * page, never a second dashboard route.
 */
export function AssetPlatformSummary() {
  const [evaluation, setEvaluation] = useState<PlatformEvaluation | null>(null);

  useEffect(() => {
    evaluatePlatformAction().then((result) => setEvaluation(result.success ? result.data : null));
  }, []);

  if (!evaluation) return <Skeleton className="mb-4 h-24 w-full" />;

  const { health, analytics } = evaluation;

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      <Card>
        <p className="text-xs text-text-muted">Total Assets</p>
        <p className="mt-1 text-2xl font-semibold">{analytics.totalAssets}</p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Total Storage</p>
        <p className="mt-1 text-2xl font-semibold">{formatBytes(analytics.totalStorageBytes)}</p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Platform Health</p>
        <p className="mt-1 flex items-center gap-2 text-2xl font-semibold">
          {health.averageScore}
          <Badge tone={HEALTH_BAND_TONE[health.band]}>{health.band}</Badge>
        </p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Unused Assets</p>
        <p className="mt-1 text-2xl font-semibold">{analytics.unusedAssetCount}</p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Downloads</p>
        <p className="mt-1 text-xl font-semibold">{analytics.totalDownloads}</p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Favorites</p>
        <p className="mt-1 text-xl font-semibold">{analytics.totalFavorites}</p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Shares</p>
        <p className="mt-1 text-xl font-semibold">{analytics.totalShares}</p>
      </Card>
      <Card>
        <p className="text-xs text-text-muted">Files Needing Attention</p>
        <p className="mt-1 text-xl font-semibold">{health.assetsWithIssues}</p>
      </Card>
    </div>
  );
}
