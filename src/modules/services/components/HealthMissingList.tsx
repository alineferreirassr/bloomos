import { HealthMissingItem } from "@/modules/services/components/HealthMissingItem";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

interface HealthMissingListProps {
  items: ServiceHealthMissingItem[];
  onSelect?: (item: ServiceHealthMissingItem) => void;
  className?: string;
}

export function HealthMissingList({ items, onSelect, className = "" }: HealthMissingListProps) {
  if (items.length === 0) return null;

  return (
    <ul className={`divide-y divide-border/60 ${className}`}>
      {items.map((item, index) => (
        <HealthMissingItem key={`${index}-${item.label}`} item={item} onSelect={onSelect} />
      ))}
    </ul>
  );
}
