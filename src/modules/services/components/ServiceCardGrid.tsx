import { ServiceCard } from "@/modules/services/components/ServiceCard";
import type { ActionMenuAction } from "@/components/ui/ActionMenu";
import type { ServiceCatalogRow } from "@/lib/queries/services/types";

interface ServiceCardGridProps {
  rows: ServiceCatalogRow[];
  selectable?: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (serviceId: string) => void;
  actionsFor: (row: ServiceCatalogRow) => ActionMenuAction[];
  className?: string;
}

export function ServiceCardGrid({ rows, selectable = false, selectedIds, onToggleSelect, actionsFor, className = "" }: ServiceCardGridProps) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 ${className}`}>
      {rows.map((row) => (
        <ServiceCard
          key={row.service.id}
          row={row}
          selectable={selectable}
          selected={selectedIds.has(row.service.id)}
          onToggleSelect={onToggleSelect}
          actions={actionsFor(row)}
        />
      ))}
    </div>
  );
}
