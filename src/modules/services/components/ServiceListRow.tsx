import { memo } from "react";
import Link from "next/link";
import { TableCell, TableRow } from "@/components/ui/Table";
import { Checkbox } from "@/components/ui/Checkbox";
import { ActionMenu, type ActionMenuAction } from "@/components/ui/ActionMenu";
import { ServiceStatusBadge } from "@/modules/services/components/ServiceStatusBadge";
import { VersionBadge } from "@/modules/services/components/VersionBadge";
import { HealthDot } from "@/modules/services/components/HealthDot";
import { ServicePrice } from "@/modules/services/components/ServicePrice";
import { ServiceUsageCount } from "@/modules/services/components/ServiceUsageCount";
import type { ServiceCatalogRow } from "@/lib/queries/services/types";

interface ServiceListRowProps {
  row: ServiceCatalogRow;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (serviceId: string) => void;
  actions: ActionMenuAction[];
}

/** One row of ServiceListTable — memoized for the same reason ServiceCard is: a Catalog table can hold many rows, and only the row whose own data/selection actually changed should re-render. */
export const ServiceListRow = memo(function ServiceListRow({ row, selectable = false, selected = false, onToggleSelect, actions }: ServiceListRowProps) {
  const { service, categoryName, publishedVersion, health, usageCount } = row;

  return (
    <TableRow selected={selected}>
      {selectable ? (
        <TableCell>
          <Checkbox aria-label={`Select ${service.name}`} checked={selected} onChange={() => onToggleSelect?.(service.id)} />
        </TableCell>
      ) : null}
      <TableCell>
        <Link href={`/services/${service.id}`} className="font-medium text-text hover:underline">
          {service.name}
        </Link>
        <p className="mt-0.5 text-xs text-text-muted">{categoryName ?? "Uncategorized"}</p>
      </TableCell>
      <TableCell>
        <ServiceStatusBadge status={service.status} />
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <HealthDot percent={health.percent} topMissingLabel={health.missing[0]?.label} />
          <span>{health.percent}%</span>
        </div>
      </TableCell>
      <TableCell>
        <ServicePrice amountMinor={publishedVersion?.base_price_minor ?? null} currency={publishedVersion?.currency ?? "USD"} />
      </TableCell>
      <TableCell>
        <ServiceUsageCount count={usageCount} />
      </TableCell>
      <TableCell>
        {publishedVersion ? (
          <VersionBadge status="published" versionNumber={publishedVersion.version_number} isCurrent />
        ) : (
          <VersionBadge status="draft" versionNumber={null} />
        )}
      </TableCell>
      <TableCell>{new Date(service.updated_at).toLocaleDateString()}</TableCell>
      <TableCell>
        <ActionMenu actions={actions} />
      </TableCell>
    </TableRow>
  );
});
