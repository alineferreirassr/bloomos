import Link from "next/link";
import type { MediaAsset } from "@/types/mediaAsset";
import { categorizeAsset, ASSET_CATEGORY_LABELS } from "@/modules/assets/assetCategory";
import { MEDIA_ASSET_STATUS_LABELS } from "@/core/enums/mediaAssetStatus";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";

const STATUS_TONE: Record<MediaAsset["status"], BadgeTone> = {
  approved: "success",
  pending: "neutral",
  needs_revision: "warning",
  rejected: "danger",
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssetCard({ asset }: { asset: MediaAsset }) {
  const category = categorizeAsset(asset);

  return (
    <Link href={`/assets/${asset.id}`}>
      <Card className="flex h-full flex-col gap-2">
        <div className="flex aspect-square w-full items-center justify-center rounded-md bg-surface-tint text-xs font-medium uppercase text-text-muted">
          {ASSET_CATEGORY_LABELS[category]}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={asset.original_filename}>
            {asset.original_filename}
          </p>
          <p className="text-xs text-text-muted">
            {formatFileSize(asset.file_size)} · v{asset.version}
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
