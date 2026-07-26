import { memo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { ServiceStatusBadge } from "@/modules/services/components/ServiceStatusBadge";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { HealthDot } from "@/modules/services/components/HealthDot";
import { ServicePrice } from "@/modules/services/components/ServicePrice";
import { ServiceUsageCount } from "@/modules/services/components/ServiceUsageCount";
import type { ServiceCatalogRow } from "@/lib/queries/services/types";

interface ServiceCardProps {
  row: ServiceCatalogRow;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (serviceId: string) => void;
  actions: ActionMenuAction[];
}

/**
 * Purely presentational — renders exactly what `row` already carries (never
 * fetches anything of its own). Memoized since a Catalog can hold many
 * cards and only the row that actually changed (or selection state) should
 * ever re-render; `actions` must be a stable-per-row array from the parent
 * for this to actually help (see `ServicesCatalogView`'s `actionsFor`).
 */
export const ServiceCard = memo(function ServiceCard({ row, selectable = false, selected = false, onToggleSelect, actions }: ServiceCardProps) {
  const { service, categoryName, publishedVersion, health, usageCount } = row;

  return (
    <Card className={selected ? "border-accent" : undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2.5">
          {selectable ? (
            <Checkbox
              aria-label={`Select ${service.name}`}
              checked={selected}
              onChange={() => onToggleSelect?.(service.id)}
              className="mt-1"
            />
          ) : null}
          <Link href={`/services/${service.id}`} className="block min-w-0 flex-1">
            <p className="truncate font-medium tracking-tight text-text">{service.name}</p>
            <p className="mt-0.5 text-xs text-text-muted">{categoryName ?? "Uncategorized"}</p>
          </Link>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <ServiceStatusBadge status={service.status} />
          <ActionMenu actions={actions} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <HealthDot percent={health.percent} topMissingLabel={health.missing[0]?.label} />
          {health.percent}%
        </span>
        <ServicePrice amountMinor={publishedVersion?.base_price_minor ?? null} currency={publishedVersion?.currency ?? "USD"} />
        <ServiceUsageCount count={usageCount} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {publishedVersion ? (
          <VersionBadge status="published" versionNumber={publishedVersion.version_number} isCurrent />
        ) : (
          <VersionBadge status="draft" versionNumber={null} />
        )}
        <span className="text-xs text-text-muted">Updated {new Date(service.updated_at).toLocaleDateString()}</span>
      </div>
    </Card>
  );
});
