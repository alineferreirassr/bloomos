import { getEvents, getEventFinancialSummary, getVendors, getPurchasesByVendorId, listInventoryItems, listInventoryMovements, listPurchases, getWorkspaceFinancialSummary } from "@/lib/data";
import type { Event } from "@/types/event";
import type { Vendor } from "@/types/vendor";
import type { WorkspaceFinancialSummary } from "@/modules/finance/financialSummary";

const COMPLETED_EVENT_LIMIT = 25;

export interface VendorPerformanceRow {
  vendor: Vendor;
  purchaseCount: number;
  totalSpentMinor: number;
}

export interface InventoryUsageRow {
  itemName: string;
  movementCount: number;
}

export interface OperationsReportsData {
  completedEvents: Event[];
  totalGrossProfitMinor: number;
  totalNetProfitMinor: number;
  vendorPerformance: VendorPerformanceRow[];
  inventoryUsage: InventoryUsageRow[];
  purchaseCount: number;
  financialSummary: WorkspaceFinancialSummary;
}

/**
 * Operations Reports (v2 Checkpoint 21, Step 16). Bounded the same way the
 * Operations Dashboard is — Completed Events profit is computed for the 25
 * most recently completed events, not the whole history, to keep the
 * fan-out reasonable; Vendor Performance and Inventory Usage are similarly
 * capped to a top-N read. "Team Performance" (named in the spec) has no
 * real per-completed-checklist-item-by-member index in this codebase
 * (`ChecklistItem.assigned_name` is free text, not aggregated anywhere) —
 * honestly omitted here rather than approximated with a misleading number.
 */
export async function getOperationsReportsData(): Promise<OperationsReportsData> {
  const [allEvents, vendors, purchases, financialSummary, inventoryItems] = await Promise.all([
    getEvents({ status: "completed", includeArchived: false }),
    getVendors({ status: "active" }),
    listPurchases({}),
    getWorkspaceFinancialSummary(),
    listInventoryItems({}),
  ]);

  const completedEvents = allEvents
    .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""))
    .slice(0, COMPLETED_EVENT_LIMIT);

  const summaries = await Promise.all(completedEvents.map((event) => getEventFinancialSummary(event.id)));
  const totalGrossProfitMinor = summaries.reduce((sum, s) => sum + s.gross_profit_minor, 0);
  const totalNetProfitMinor = summaries.reduce((sum, s) => sum + s.net_profit_minor, 0);

  const vendorPurchaseLists = await Promise.all(vendors.slice(0, 10).map((vendor) => getPurchasesByVendorId(vendor.id)));
  const vendorPerformance: VendorPerformanceRow[] = vendors.slice(0, 10).map((vendor, index) => ({
    vendor,
    purchaseCount: vendorPurchaseLists[index].length,
    totalSpentMinor: vendorPurchaseLists[index].reduce((sum, p) => sum + p.total_minor, 0),
  }));

  const topInventoryItems = [...inventoryItems].sort((a, b) => b.quantity_reserved - a.quantity_reserved).slice(0, 10);
  const movementLists = await Promise.all(topInventoryItems.map((item) => listInventoryMovements(item.id)));
  const inventoryUsage: InventoryUsageRow[] = topInventoryItems.map((item, index) => ({
    itemName: item.name,
    movementCount: movementLists[index].length,
  }));

  return {
    completedEvents,
    totalGrossProfitMinor,
    totalNetProfitMinor,
    vendorPerformance: vendorPerformance.filter((row) => row.purchaseCount > 0).sort((a, b) => b.totalSpentMinor - a.totalSpentMinor),
    inventoryUsage: inventoryUsage.filter((row) => row.movementCount > 0),
    purchaseCount: purchases.length,
    financialSummary,
  };
}
