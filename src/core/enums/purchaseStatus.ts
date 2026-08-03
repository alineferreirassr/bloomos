/**
 * Mirrors Invoice's own status enum shape (`core/enums/invoiceStatus.ts`) —
 * `archived` is a real member here too, not a separate boolean, so a
 * restored Purchase has one obvious re-entry point (`draft`) instead of
 * needing to remember whatever status it had before archiving. See
 * `core/workflows/purchaseWorkflow.ts`'s transition table for exactly which
 * moves are legal.
 */
export const PURCHASE_STATUSES = ["draft", "submitted", "partially_received", "fully_received", "cancelled", "archived"] as const;

export type PurchaseStatus = (typeof PURCHASE_STATUSES)[number];

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  partially_received: "Partially Received",
  fully_received: "Fully Received",
  cancelled: "Cancelled",
  archived: "Archived",
};
