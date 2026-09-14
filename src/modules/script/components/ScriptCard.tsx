"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatDateOnly } from "@/lib/dateFormat";
import type { ScriptItem } from "@/types/scriptItem";

interface ScriptCardProps {
  item: ScriptItem;
  onOpen: (item: ScriptItem) => void;
}

/**
 * A native `<button>`, not a `<Link>` — mirrors `IdeaCard.tsx`/
 * `InspirationCard.tsx` exactly: opens a bounded detail dialog rather than
 * a full editor route, giving keyboard access (Enter/Space) for free.
 */
export function ScriptCard({ item, onOpen }: ScriptCardProps) {
  return (
    <button type="button" onClick={() => onOpen(item)} className="block w-full text-left">
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">{item.archived_at ? <Badge tone="neutral">Archived</Badge> : null}</div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-serif text-base font-semibold text-text" title={item.title}>
            {item.title}
          </p>
        </div>

        <p className="text-[11px] text-text-muted">Created {formatDateOnly(item.created_at)}</p>
      </Card>
    </button>
  );
}
