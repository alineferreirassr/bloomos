import { getLowStockInventoryItems, getEvents } from "@/lib/data";
import { isInventoryItemLowStock } from "@/modules/inventory/inventoryStats";
import type { SuggestionProvider, CopilotSuggestion } from "@/core/ai/copilot/suggestionEngine";

const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Checkpoint 20, Step 7 — Inventory suggestions: Restock, Reserve, Bundle.
 * `Bundle` stays purely informational — this codebase has no purchase/event
 * line-item co-occurrence data to compute a real "frequently used together"
 * pairing from (see Known Limitations in the checkpoint docs), so it's a
 * general reminder, never a fabricated pairing presented as data-derived.
 */
export const inventorySuggestionProvider: SuggestionProvider = {
  module: "inventory",
  async compute(): Promise<CopilotSuggestion[]> {
    const [lowStockItems, events] = await Promise.all([getLowStockInventoryItems(), getEvents({ includeArchived: false })]);
    const suggestions: CopilotSuggestion[] = [];

    const trulyLow = lowStockItems.filter(isInventoryItemLowStock);
    for (const item of trulyLow.slice(0, 3)) {
      suggestions.push({
        id: `inventory-restock-${item.id}`,
        module: "inventory",
        label: `Restock ${item.name}`,
        description: `${item.quantity_available} available, at or below the reorder level of ${item.reorder_level}.`,
        actionId: null,
        tone: "warning",
      });
    }

    const now = Date.now();
    const upcomingSoon = events.filter((event) => {
      if (!event.event_date) return false;
      const eventTime = new Date(event.event_date).getTime();
      return eventTime >= now && eventTime - now <= TWO_WEEKS_MS;
    });
    if (trulyLow.length > 0 && upcomingSoon.length > 0) {
      suggestions.push({
        id: "inventory-reserve-upcoming",
        module: "inventory",
        label: `Reserve remaining stock for ${upcomingSoon.length} event${upcomingSoon.length === 1 ? "" : "s"} in the next two weeks`,
        description: "Low-stock items and near-term events overlap — confirm what's already reserved before it runs out.",
        actionId: null,
        tone: "warning",
      });
    }

    if (trulyLow.length > 0) {
      suggestions.push({
        id: "inventory-bundle-reminder",
        module: "inventory",
        label: "Consider bundling frequently paired items into one purchase order",
        description: "A general reminder — this workspace doesn't yet track which items are typically ordered together.",
        actionId: null,
        tone: "info",
      });
    }

    return suggestions;
  },
};
