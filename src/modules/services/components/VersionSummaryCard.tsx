import { Card } from "@/components/ui/Card";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { ServiceStatusBadge } from "@/modules/services/components/ServiceStatusBadge";
import { ServicePrice } from "@/modules/services/components/ServicePrice";
import type { ServiceStatus } from "@/core/enums/serviceStatus";
import type { VersionHistoryRow } from "@/lib/queries/services/types";

interface VersionSummaryCardProps {
  row: VersionHistoryRow;
  serviceStatus: ServiceStatus;
  isLatestPublished: boolean;
}

/** The detail panel's header — read-only, no edit affordance anywhere (see DraftVersionForm for the one place this same data is actually editable). */
export function VersionSummaryCard({ row, serviceStatus, isLatestPublished }: VersionSummaryCardProps) {
  const { version } = row;
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-serif text-xl font-semibold text-text">{row.isCurrentDraft ? "Draft" : `Version ${version.version_number}`}</h2>
        <div className="flex items-center gap-2">
          <ServiceStatusBadge status={serviceStatus} />
          <VersionBadge status={version.status} versionNumber={version.version_number} isCurrent={isLatestPublished} />
        </div>
      </div>
      <div className="mt-3">
        <ServicePrice amountMinor={version.base_price_minor} currency={version.currency} />
      </div>
      <dl className="mt-3 space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-text-muted">Published</dt>
          <dd className="text-text">{version.published_at ? new Date(version.published_at).toLocaleString() : "Not yet published"}</dd>
        </div>
        {version.published_by ? (
          <div className="flex gap-2">
            <dt className="text-text-muted">Published by</dt>
            <dd className="text-text">{version.published_by}</dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}
