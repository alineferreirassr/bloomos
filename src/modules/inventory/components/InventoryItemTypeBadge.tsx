import { Badge } from "@/components/ui/Badge";
import { INVENTORY_ITEM_TYPE_LABELS, type InventoryItemType } from "@/core/enums/inventoryItemType";

export function InventoryItemTypeBadge({ itemType }: { itemType: InventoryItemType }) {
  return <Badge tone="neutral">{INVENTORY_ITEM_TYPE_LABELS[itemType]}</Badge>;
}
