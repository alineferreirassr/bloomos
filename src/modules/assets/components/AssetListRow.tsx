import Link from "next/link";
import type { MediaAsset } from "@/types/mediaAsset";
import { categorizeAsset, ASSET_CATEGORY_LABELS } from "@/modules/assets/assetCategory";
import { MEDIA_ASSET_STATUS_LABELS } from "@/core/enums/mediaAssetStatus";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { AssetThumbnail } from "@/modules/assets/components/AssetThumbnail";
import { formatBytes } from "@/modules/documents/mappers";

const STATUS_TONE: Record<MediaAsset["status"], BadgeTone> = {
  approved: "success",
  pending: "neutral",
  needs_revision: "warning",
  rejected: "danger",
};

interface AssetListRowProps {
  asset: MediaAsset;
  relatedLabel?: string;
}

/** Denser, metadata-first alternative to the grid `AssetCard` — same canonical asset, no separate data pipeline, just a different arrangement of the same fields (plus a small thumbnail rather than a hero one). */
export function AssetListRow({ asset, relatedLabel }: AssetListRowProps) {
  const category = categorizeAsset(asset);

  return (
    <Link
      href={`/assets/${asset.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 transition-colors duration-150 hover:bg-surface-tint"
    >
      <div className="h-12 w-12 shrink-0">
        <AssetThumbnail asset={asset} variant="card" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text" title={asset.original_filename}>
          {asset.original_filename}
        </p>
        <p className="truncate text-xs text-text-muted">
          {ASSET_CATEGORY_LABELS[category]} · {formatBytes(asset.file_size)}
          {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
          {relatedLabel ? ` · ${relatedLabel}` : ""}
        </p>
      </div>
      <div className="hidden shrink-0 text-xs text-text-muted sm:block">{new Date(asset.created_at).toLocaleDateString()}</div>
      <Badge tone={STATUS_TONE[asset.status]}>{MEDIA_ASSET_STATUS_LABELS[asset.status]}</Badge>
    </Link>
  );
}
