"use client";

import { useCallback, useMemo, useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";
import { useVersionHistory } from "@/modules/services/hooks/useVersionHistory";
import { VersionHistoryLoadingState } from "@/modules/services/components/VersionHistoryLoadingState";
import { VersionHistoryEmptyState } from "@/modules/services/components/VersionHistoryEmptyState";
import { VersionTimeline } from "@/modules/services/components/VersionTimeline";
import { VersionSummaryCard } from "@/modules/services/components/VersionSummaryCard";
import { VersionMetadataCard } from "@/modules/services/components/VersionMetadataCard";
import { VersionDiffSummary } from "@/modules/services/components/VersionDiffSummary";
import { VersionChangeList } from "@/modules/services/components/VersionChangeList";
import { VersionHistorySidebar } from "@/modules/services/components/VersionHistorySidebar";
import type { VersionHistoryRow } from "@/lib/queries/services/types";

interface VersionHistoryPageProps {
  serviceId: string;
}

/** Draft first (it's always the newest, actively-edited entity), then published versions newest-first by version number — "Chronological order. Newest first." from a Service's point of view, not a raw timestamp sort. */
function sortNewestFirst(rows: VersionHistoryRow[]): VersionHistoryRow[] {
  return [...rows].sort((a, b) => {
    if (a.isCurrentDraft) return -1;
    if (b.isCurrentDraft) return 1;
    return (b.version.version_number ?? 0) - (a.version.version_number ?? 0);
  });
}

function versionLabel(row: VersionHistoryRow): string {
  return row.isCurrentDraft ? "Draft" : `Version ${row.version.version_number}`;
}

/**
 * Entirely read-only — every mutation this data could ever prompt (editing
 * the draft, publishing, archiving) lives on Overview, the Template
 * Builder, or the Publish Workflow. This page only ever calls
 * `useVersionHistory` (plus, lazily, `useTemplateBuilder` for whichever
 * single version is selected) and renders what comes back.
 */
export function VersionHistoryPage({ serviceId }: VersionHistoryPageProps) {
  const query = useVersionHistory(serviceId);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  const sortedRows = useMemo(() => (query.data ? sortNewestFirst(query.data.rows) : []), [query.data]);

  const handleSelect = useCallback((row: VersionHistoryRow) => {
    setSelectedVersionId(row.version.id);
  }, []);

  if (query.status === "pending") {
    return <VersionHistoryLoadingState />;
  }

  if (query.status === "error") {
    return <ErrorState message="We couldn't load Version History." onRetry={() => query.refetch()} />;
  }

  if (sortedRows.length === 0) {
    return <VersionHistoryEmptyState />;
  }

  const { service } = query.data;
  const latestPublishedVersionId = service.current_published_version_id;
  const selectedRow = sortedRows.find((row) => row.version.id === selectedVersionId) ?? sortedRows[0];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div>
        <VersionTimeline rows={sortedRows} selectedVersionId={selectedRow.version.id} latestPublishedVersionId={latestPublishedVersionId} onSelect={handleSelect} />
      </div>

      <div className="space-y-4 lg:col-span-1">
        <p role="status" aria-live="polite" className="sr-only">
          Viewing {versionLabel(selectedRow)}.
        </p>
        <VersionSummaryCard row={selectedRow} serviceStatus={service.status} isLatestPublished={selectedRow.version.id === latestPublishedVersionId} />
        <VersionMetadataCard version={selectedRow.version} />
        <VersionDiffSummary version={selectedRow.version} />
        <VersionChangeList serviceVersionId={selectedRow.version.id} />
      </div>

      <div>
        <VersionHistorySidebar rows={sortedRows} latestPublishedVersionId={latestPublishedVersionId} selectedVersionId={selectedRow.version.id} onSelect={handleSelect} />
      </div>
    </div>
  );
}
