import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { INVENTORY_STATUS_LABELS, type InventoryStatus } from "@/core/enums/inventoryStatus";

/* Same 3-tone convention as ClientStatusBadge: outline for active, neutral for inactive/archived — status alone is never the only signal (archived state is also reflected in page copy/actions). */
const STATUS_TONES: Record<InventoryStatus, BadgeTone> = {
  active: "outline",
  inactive: "neutral",
  archived: "neutral",
};

export function InventoryStatusBadge({ status }: { status: InventoryStatus }) {
  return <Badge tone={STATUS_TONES[status]}>{INVENTORY_STATUS_LABELS[status]}</Badge>;
}
