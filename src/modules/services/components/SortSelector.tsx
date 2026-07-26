import { Select } from "@/components/ui/Select";
import type { ServicesCatalogFilters } from "@/lib/queries/services/types";

export type ServicesCatalogSortBy = NonNullable<ServicesCatalogFilters["sortBy"]>;

const SORT_LABELS: Record<ServicesCatalogSortBy, string> = {
  name: "Name",
  health: "Health",
  usage: "Usage",
  updatedAt: "Last updated",
};

const SORT_KEYS = Object.keys(SORT_LABELS) as ServicesCatalogSortBy[];

interface SortSelectorProps {
  value: ServicesCatalogSortBy;
  onChange: (value: ServicesCatalogSortBy) => void;
  className?: string;
}

export function SortSelector({ value, onChange, className = "" }: SortSelectorProps) {
  return (
    <Select aria-label="Sort by" value={value} onChange={(event) => onChange(event.target.value as ServicesCatalogSortBy)} className={className}>
      {SORT_KEYS.map((key) => (
        <option key={key} value={key}>
          Sort: {SORT_LABELS[key]}
        </option>
      ))}
    </Select>
  );
}
