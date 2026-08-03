import { listInventoryItems, getLowStockInventoryItems, getDamagedOrUnderRepairInventoryItems, getEvents } from "@/lib/data";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";

export interface InventoryAssistantItem {
  itemId: string;
  name: string;
  quantityAvailable: number;
  reorderLevel: number | null;
}

export interface InventoryAssistant {
  lowStock: InventoryAssistantItem[];
  /** Same set as `lowStock` — a purchase against the reorder level is the deterministic definition of "suggested" this checkpoint can honestly support (see Known Limitations for why a true recommendation engine is out of scope). */
  suggestedPurchases: InventoryAssistantItem[];
  upcomingEventCount: number;
  /** 0-100 — the share of active items that are neither low-stock nor damaged/under repair. */
  healthScore: number;
  frequentlyUsedTogetherNote: string;
}

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Checkpoint 20, Step 13 — the Inventory Assistant. Every field is a real,
 * deterministic computation over already-fetched Inventory/Event data — no
 * LLM, matching the same principle `generateExecutiveBrief.ts` follows.
 * "Frequently Used Together" stays an honest note rather than a fabricated
 * pairing — this workspace has no purchase/event line-item co-occurrence
 * data to compute a real correlation from (same limitation
 * `inventorySuggestions.ts`'s own "Bundle" suggestion already documents).
 */
export async function generateInventoryAssistant(): Promise<InventoryAssistant> {
  const [allItems, lowStockItems, damagedItems, events] = await Promise.all([
    listInventoryItems({ includeArchived: false }),
    getLowStockInventoryItems(),
    getDamagedOrUnderRepairInventoryItems(),
    getEvents({ includeArchived: false }),
  ]);

  const trulyLow = lowStockItems.filter(isInventoryItemLowStock);
  const lowStock: InventoryAssistantItem[] = trulyLow.map((item) => ({
    itemId: item.id,
    name: item.name,
    quantityAvailable: item.quantity_available,
    reorderLevel: item.reorder_level,
  }));

  const now = Date.now();
  const upcomingEventCount = events.filter((event) => {
    if (!event.event_date) return false;
    const t = new Date(event.event_date).getTime();
    return t >= now && t - now <= TWO_WEEKS_MS;
  }).length;

  const activeCount = allItems.filter((item) => item.status === "active").length;
  const problemCount = trulyLow.length + damagedItems.length;
  const healthScore = activeCount > 0 ? Math.round(((activeCount - Math.min(problemCount, activeCount)) / activeCount) * 100) : 100;

  return {
    lowStock,
    suggestedPurchases: lowStock,
    upcomingEventCount,
    healthScore,
    frequentlyUsedTogetherNote: "This workspace doesn't yet track which items are typically ordered together — a future checkpoint could compute this from real Purchase line-item history.",
  };
}
