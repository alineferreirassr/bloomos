import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { INVENTORY_CONDITION_LABELS, type InventoryCondition } from "@/core/enums/inventoryCondition";

const CONDITION_TONES: Record<InventoryCondition, BadgeTone> = {
  new: "outline",
  excellent: "outline",
  good: "neutral",
  fair: "warning",
  damaged: "danger",
  under_repair: "warning",
  retired: "neutral",
};

/** Renders nothing for a `null` condition (always true for consumable items — condition only applies to reusable items). */
export function InventoryConditionBadge({ condition }: { condition: InventoryCondition | null }) {
  if (condition === null) return null;
  return <Badge tone={CONDITION_TONES[condition]}>{INVENTORY_CONDITION_LABELS[condition]}</Badge>;
}
