import type { Purchase } from "@/types/purchase";
import type { PurchaseStatus } from "@/core/enums/purchaseStatus";
import { sumMinor } from "@/lib/money";

/**
 * Pure — no I/O. Mirrors modules/inventory/inventoryStats.ts's
 * computeInventorySummary: a client-side rollup over arrays the caller
 * already fetched (listPurchases({includeArchived:true}) +
 * getOverduePurchases()), not a new repository/backend summary method —
 * PurchasesRepository has no dedicated stats method to call instead.
 */
export interface PurchaseSummary {
  open: number;
  overdue: number;
  partiallyReceived: number;
  /**
   * Sum of total_minor across every open (submitted/partially_received)
   * Purchase — an integer minor-unit amount, never a float. Each Purchase
   * carries its own `currency`, so this sum is only meaningful when every
   * open Purchase shares one currency; displayed formatted as USD, the same
   * disclosed simplification InventoryItemDetailView already uses for its
   * own money fields (no workspace-level default currency exists yet).
   */
  totalOpenValueMinor: number;
}

export function computePurchaseSummary(allPurchases: Purchase[], overduePurchases: Purchase[]): PurchaseSummary {
  const open = allPurchases.filter((purchase) => purchase.status === "submitted" || purchase.status === "partially_received");
  return {
    open: open.length,
    overdue: overduePurchases.length,
    partiallyReceived: allPurchases.filter((purchase) => purchase.status === "partially_received").length,
    totalOpenValueMinor: sumMinor(open.map((purchase) => purchase.total_minor)),
  };
}

/**
 * A coarse, status-only receipt indicator for list rows — the exact
 * ordered/received quantities live on PurchaseItem rows
 * (getPurchaseReceiptSummary), which the list view deliberately doesn't
 * fetch per row (that would be one extra round trip per Purchase). The
 * Purchase detail page shows the precise quantities; this is only a
 * quick-glance label.
 */
export function receiptProgressLabel(status: PurchaseStatus): string {
  switch (status) {
    case "draft":
    case "cancelled":
    case "archived":
      return "—";
    case "submitted":
      return "Not started";
    case "partially_received":
      return "Partial";
    case "fully_received":
      return "Complete";
  }
}
