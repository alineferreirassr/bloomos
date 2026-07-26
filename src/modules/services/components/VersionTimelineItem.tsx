"use client";

import { forwardRef, memo } from "react";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { CurrentVersionBadge } from "@/modules/services/components/CurrentVersionBadge";
import { LatestPublishedBadge } from "@/modules/services/components/LatestPublishedBadge";
import type { VersionHistoryRow } from "@/lib/queries/services/types";

interface VersionTimelineItemProps {
  row: VersionHistoryRow;
  isSelected: boolean;
  isLatestPublished: boolean;
  onSelect: (row: VersionHistoryRow) => void;
}

function versionLabel(row: VersionHistoryRow): string {
  return row.isCurrentDraft ? "Draft" : `Version ${row.version.version_number}`;
}

const VersionTimelineItemImpl = forwardRef<HTMLButtonElement, VersionTimelineItemProps>(function VersionTimelineItemImpl(
  { row, isSelected, isLatestPublished, onSelect },
  ref,
) {
  const { version } = row;

  return (
    <button
      ref={ref}
      type="button"
      role="option"
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(row)}
      className={`w-full rounded-md border px-3 py-2 text-left transition-colors duration-150 ${
        isSelected ? "border-accent bg-accent/8" : "border-transparent hover:bg-text/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-text">{versionLabel(row)}</span>
        <VersionBadge status={version.status} versionNumber={version.version_number} isCurrent={isLatestPublished} />
        {row.isCurrentDraft ? <CurrentVersionBadge /> : null}
        {isLatestPublished ? <LatestPublishedBadge /> : null}
      </div>
      <p className="mt-1 text-xs text-text-muted">
        {version.published_at ? new Date(version.published_at).toLocaleString() : "Not yet published"}
        {version.published_by ? ` · ${version.published_by}` : ""}
      </p>
    </button>
  );
});

/** Rows are only replaced when the underlying query actually refetches — memoizing avoids re-rendering every other timeline entry when only the selection changes. */
export const VersionTimelineItem = memo(VersionTimelineItemImpl);
