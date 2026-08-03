"use client";

import { Card } from "@/components/ui/Card";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import type { VersionHistoryRow } from "@/lib/queries/services/types";

interface VersionHistorySidebarProps {
  rows: VersionHistoryRow[];
  latestPublishedVersionId: string | null;
  selectedVersionId: string;
  onSelect: (row: VersionHistoryRow) => void;
}

export function VersionHistorySidebar({ rows, latestPublishedVersionId, selectedVersionId, onSelect }: VersionHistorySidebarProps) {
  const draftRow = rows.find((row) => row.isCurrentDraft) ?? null;
  const publishedRows = rows.filter((row) => row.version.status === "published");
  const latestPublishedRow = publishedRows.find((row) => row.version.id === latestPublishedVersionId) ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Current published version</h4>
        {latestPublishedRow ? (
          <>
            <div className="mt-2">
              <VersionBadge status="published" versionNumber={latestPublishedRow.version.version_number} isCurrent />
            </div>
            <p className="mt-2 text-xs text-text-muted">Published {latestPublishedRow.version.published_at ? new Date(latestPublishedRow.version.published_at).toLocaleDateString() : "—"}</p>
          </>
        ) : (
          <p className="mt-2 text-sm text-text-muted">This Service has never been published.</p>
        )}
      </Card>

      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Draft version</h4>
        <p className="mt-2 text-sm text-text">{draftRow ? "Actively being edited" : "—"}</p>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Total published versions</h4>
        <p className="mt-2 text-lg font-semibold text-text">{publishedRows.length}</p>
      </Card>

      <Card>
        <h4 className="text-xs font-semibold tracking-wide text-text-muted uppercase">Quick navigation</h4>
        <ul className="mt-2 space-y-0.5">
          {rows.map((row) => (
            <li key={row.version.id}>
              <button
                type="button"
                aria-current={row.version.id === selectedVersionId ? "true" : undefined}
                onClick={() => onSelect(row)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-1.5 py-1 text-left text-sm transition-colors duration-150 hover:bg-text/7 ${
                  row.version.id === selectedVersionId ? "text-accent" : "text-text"
                }`}
              >
                <span>{row.isCurrentDraft ? "Draft" : `Version ${row.version.version_number}`}</span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
