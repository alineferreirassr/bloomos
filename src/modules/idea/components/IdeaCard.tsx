"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import { IDEA_PRIORITY_LABELS } from "@/modules/idea/labels";
import { INSPIRATION_CONTENT_FORMAT_LABELS } from "@/modules/inspiration/labels";
import type { IdeaItem } from "@/types/ideaItem";

interface IdeaCardProps {
  item: IdeaItem;
  onOpen: (item: IdeaItem) => void;
}

/**
 * A native `<button>`, not a `<Link>` — mirrors `InspirationCard.tsx`
 * exactly: SOCIAL-07D opens a bounded read-only detail dialog rather than a
 * full editor route, and a native button gives keyboard access (Enter/
 * Space) for free.
 */
export function IdeaCard({ item, onOpen }: IdeaCardProps) {
  return (
    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {item.priority ? <Badge tone={item.archived_at ? "neutral" : "accent"}>{IDEA_PRIORITY_LABELS[item.priority]}</Badge> : null}
          {item.content_format ? <Badge tone="neutral">{INSPIRATION_CONTENT_FORMAT_LABELS[item.content_format]}</Badge> : null}
          {item.archived_at ? <Badge tone="neutral">Archived</Badge> : null}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base font-semibold text-text" title={item.title}>
            {item.title}
          </p>
          <p className="mt-2 line-clamp-2 text-sm text-text/80">{item.description}</p>
        </div>

        <p className="text-[11px] text-text-muted">Created {formatDateOnly(item.created_at)}</p>
      </Card>
    </button>
  );
}
