import type { EventServiceInventoryRequirement } from "@/types/eventServiceInventoryRequirement";
import type { InventoryItem } from "@/types/inventoryItem";
import { type PackingCategory, type PackingListItem } from "@/core/operations/types";

/**
 * PackingEngine (v2 Checkpoint 21, Step 4) — extends the packing/shopping
 * split `eventAssistant.ts` (Checkpoint 20) already derives from
 * `EventServiceInventoryRequirement.inventory_item_id`, adding the one
 * piece that generator didn't need: sorting every real requirement into the
 * 10 named packing categories the spec asks for (Decoration, Flowers,
 * Candles, Balloons, Furniture, Tools, Extension Cords, Lighting, Vehicle
 * Requirements, Safety Items). Nothing here is a hardcoded item list — every
 * `PackingListItem` comes from a real `EventServiceInventoryRequirement`
 * row; only the *classification rule* (which category a given item's own
 * category/subcategory/tags/name text maps to) is a fixed keyword table,
 * the same kind of curated-but-generic mapping `EXPENSE_CATEGORY_LABELS`/
 * `SCHEDULE_CATEGORY_LABELS` already use elsewhere in this codebase.
 */

const CATEGORY_KEYWORDS: Array<{ category: PackingCategory; keywords: string[] }> = [
  { category: "flowers", keywords: ["flower", "floral", "bouquet", "rose", "ranunculus", "greenery", "petal"] },
  { category: "candles", keywords: ["candle", "votive", "taper"] },
  { category: "balloons", keywords: ["balloon"] },
  { category: "furniture", keywords: ["chair", "table", "sofa", "lounge", "furniture", "arch", "backdrop stand"] },
  { category: "lighting", keywords: ["light", "lighting", "lamp", "string light", "chandelier", "uplight"] },
  { category: "extension_cords", keywords: ["extension cord", "power strip", "cable", "cord"] },
  { category: "tools", keywords: ["tool", "drill", "ladder", "hammer", "toolkit", "zip tie", "tape"] },
  { category: "vehicle", keywords: ["van", "vehicle", "truck", "trailer", "delivery vehicle"] },
  { category: "safety", keywords: ["safety", "fire extinguisher", "first aid", "safety kit", "helmet", "cone"] },
  { category: "decoration", keywords: ["decor", "vase", "linen", "runner", "centerpiece", "drape", "ribbon", "signage", "backdrop"] },
];

/** Pure — classifies one requirement's item name (or its matched InventoryItem's own category/subcategory/tags) into a PackingCategory via substring matching. Falls back to "other" when nothing matches, never guesses. */
export function classifyPackingCategory(itemName: string, inventoryItem: InventoryItem | null): PackingCategory {
  const haystack = [
    itemName,
    inventoryItem?.category ?? "",
    inventoryItem?.subcategory ?? "",
    ...(inventoryItem?.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();

  for (const { category, keywords } of CATEGORY_KEYWORDS) {
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return category;
    }
  }
  return "other";
}

/** Pure — builds the full categorized packing list from real requirements and their (already-fetched) matched inventory items. */
export function buildPackingList(
  requirements: EventServiceInventoryRequirement[],
  inventoryItemsById: Map<string, InventoryItem>,
): PackingListItem[] {
  return requirements
    .filter((requirement) => !requirement.is_fulfilled)
    .map((requirement) => {
      const inventoryItem = requirement.inventory_item_id ? (inventoryItemsById.get(requirement.inventory_item_id) ?? null) : null;
      return {
        itemName: requirement.item_name,
        quantity: requirement.quantity,
        category: classifyPackingCategory(requirement.item_name, inventoryItem),
        source: requirement.inventory_item_id !== null ? ("inventory" as const) : ("shopping" as const),
        inventoryItemId: requirement.inventory_item_id,
      };
    });
}

/** Groups a flat packing list by category, in the spec's own display order, omitting empty categories. */
export function groupPackingListByCategory(items: PackingListItem[]): Array<{ category: PackingCategory; items: PackingListItem[] }> {
  const order: PackingCategory[] = ["decoration", "flowers", "candles", "balloons", "furniture", "tools", "extension_cords", "lighting", "vehicle", "safety", "other"];
  return order
    .map((category) => ({ category, items: items.filter((item) => item.category === category) }))
    .filter((group) => group.items.length > 0);
}
