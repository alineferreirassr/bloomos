"use client";

import type { KeyboardEvent } from "react";
import { VersionTimelineItem } from "@/modules/services/components/VersionTimelineItem";
import type { VersionHistoryRow } from "@/lib/queries/services/types";

interface VersionTimelineProps {
  rows: VersionHistoryRow[];
  selectedVersionId: string;
  latestPublishedVersionId: string | null;
  onSelect: (row: VersionHistoryRow) => void;
}

/**
 * Newest first, always: `rows` already arrives sorted by the caller (draft
 * first, then published versions by descending version number) — this
 * component only renders, it never re-sorts. Keyboard behavior mirrors
 * `TabList`'s own roving-tabindex pattern (`components/ui/Tabs.tsx`):
 * Up/Down/Home/End move focus and selection together, the same
 * "automatic activation" model, just vertical instead of horizontal since
 * this is a timeline, not a tab strip.
 */
export function VersionTimeline({ rows, selectedVersionId, latestPublishedVersionId, onSelect }: VersionTimelineProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
    if (options.length === 0) return;
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);

    let nextIndex: number | null = null;
    if (event.key === "ArrowDown") nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % options.length;
    else if (event.key === "ArrowUp") nextIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + options.length) % options.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = options.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    options[nextIndex].focus();
    options[nextIndex].click();
  }

  return (
    <ul role="listbox" aria-label="Version history" onKeyDown={handleKeyDown} className="space-y-1.5 border-l border-border pl-4">
      {rows.map((row) => (
        <li key={row.version.id} className="relative">
          <span aria-hidden="true" className={`absolute -left-[21px] top-3 h-2 w-2 rounded-full ${row.version.id === selectedVersionId ? "bg-accent" : "bg-border"}`} />
          <VersionTimelineItem
            row={row}
            isSelected={row.version.id === selectedVersionId}
            isLatestPublished={row.version.id === latestPublishedVersionId}
            onSelect={onSelect}
          />
        </li>
      ))}
    </ul>
  );
}
