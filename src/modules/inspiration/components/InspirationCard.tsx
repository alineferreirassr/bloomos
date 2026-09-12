"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import { InspirationThumbnail } from "@/modules/inspiration/components/InspirationThumbnail";
import { INSPIRATION_SOURCE_TYPE_LABELS, INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import type { InspirationItem } from "@/types/inspirationItem";

interface InspirationCardProps {
  item: InspirationItem;
  onOpen: (item: InspirationItem) => void;
}

function formatCreatorLine(item: InspirationItem): string | null {
  const handle = item.creator_handle ? `@${item.creator_handle.replace(/^@/, "")}` : null;
  const parts = [item.creator_name, handle].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * A native `<button>`, not a `<Link>` — SOCIAL-06D deliberately opens a
 * bounded detail dialog rather than a full editor route (Phase 19), and a
 * native button gives keyboard access (Enter/Space) for free without a
 * separate `role="button"`/`onKeyDown` implementation.
 */
export function InspirationCard({ item, onOpen }: InspirationCardProps) {
  const creatorLine = formatCreatorLine(item);

  return (
    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
      <Card className="flex flex-col gap-3 p-4">
        <InspirationThumbnail mediaAssetId={item.media_asset_id} sourceType={item.source_type} title={item.title} />

        {/* Platform/format/archived stay identifiable but deliberately small and muted-toned — the title below is this card's strongest element, not these badges. */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={item.archived_at ? "neutral" : "accent"}>{INSPIRATION_SOURCE_TYPE_LABELS[item.source_type]}</Badge>
          {item.content_format ? <Badge tone="neutral">{INSPIRATION_CONTENT_FORMAT_LABELS[item.content_format]}</Badge> : null}
          {item.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base font-semibold text-text" title={item.title}>
            {item.title}
          </p>
          {creatorLine ? <p className="mt-1 truncate text-sm text-text-muted">{creatorLine}</p> : null}
          {item.hook ? <p className="mt-2 line-clamp-2 text-sm text-text/80">{item.hook}</p> : null}
        </div>

        <p className="text-[11px] text-text-muted">Saved {formatDateOnly(item.created_at)}</p>
      </Card>
    </button>
  );
}
