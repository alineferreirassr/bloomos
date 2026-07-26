import { Card } from "@/components/ui/Card";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { ServicePrice } from "@/modules/services/components/ServicePrice";
import type { ServiceVersion } from "@/types/serviceVersion";

interface ServiceVersionSummaryProps {
  publishedVersion: ServiceVersion | null;
}

/** Read-only — the published version is immutable, so this never renders any edit affordance, unlike DraftVersionForm. `null` means the Service has never been published yet (still `status: "draft"`). */
export function ServiceVersionSummary({ publishedVersion }: ServiceVersionSummaryProps) {
  if (!publishedVersion) {
    return (
      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Published version</h3>
        <p className="mt-2 text-sm text-text-muted">This Service has never been published — only its draft version exists so far.</p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">Published version</h3>
        <VersionBadge status={publishedVersion.status} versionNumber={publishedVersion.version_number} isCurrent />
      </div>
      <div className="mt-2">
        <ServicePrice amountMinor={publishedVersion.base_price_minor} currency={publishedVersion.currency} />
      </div>
      <p className="mt-2 text-xs text-text-muted">Published {new Date(publishedVersion.published_at as string).toLocaleDateString()}</p>
      {publishedVersion.change_summary ? <p className="mt-2 text-sm text-text">{publishedVersion.change_summary}</p> : null}
    </Card>
  );
}
