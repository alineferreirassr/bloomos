import Link from "next/link";
import type { MediaAsset } from "@/types/mediaAsset";
import { categorizeAsset } from "@/modules/assets/assetCategory";
import { MEDIA_ASSET_STATUS_LABELS } from "@/core/enums/mediaAssetStatus";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { AssetThumbnail } from "@/modules/assets/components/AssetThumbnail";
import { formatBytes } from "@/modules/documents/mappers";

const STATUS_TONE: Record<MediaAsset["status"], BadgeTone> = {
  approved: "success",
  pending: "neutral",
  needs_revision: "warning",
  rejected: "danger",
};

function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${rest.toString().padStart(2, "0")}`;
}

interface AssetCardProps {
  asset: MediaAsset;
  /** Display name of the Event/Client this asset belongs to, when `owner_type` resolves to one — real relationship data, never fabricated. */
  relatedLabel?: string;
}

export function AssetCard({ asset, relatedLabel }: AssetCardProps) {
  const category = categorizeAsset(asset);

  return (
    <Link href={`/assets/${asset.id}`} className="group block">
      <Card className="flex h-full flex-col gap-3 p-3">
        <div className="relative">
          <AssetThumbnail asset={asset} variant="card" />
          {category === "video" && asset.duration ? (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {formatDuration(asset.duration)}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text" title={asset.original_filename}>
            {asset.original_filename}
          </p>
          <p className="mt-0.5 truncate text-xs text-text-muted">
            {formatBytes(asset.file_size)}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {relatedLabel ? ` · ${relatedLabel}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[asset.status]}>{MEDIA_ASSET_STATUS_LABELS[asset.status]}</Badge>
          {asset.tags.slice(0, 2).map((tag) => (
            <span key={tag} className="rounded-full bg-text/5 px-2 py-0.5 text-[11px] text-text-muted">
              {tag}
            </span>
          ))}
        </div>
      </Card>
    </Link>
  );
}
