import { PURCHASE_STATUSES, type PurchaseStatus } from "@/core/enums/purchaseStatus";
import { addMinor, subtractMinor, sumMinor } from "@/lib/money";
import type { PurchaseItem } from "@/types/purchaseItem";

export { PURCHASE_STATUSES };
export type { PurchaseStatus };

/**
 * The canonical Purchase lifecycle — same "no plain status setter, every
 * transition is a dedicated data-layer action" rule Invoice's own
 * `INVOICE_TRANSITIONS` follows (`core/workflows/invoiceWorkflow.ts`).
 * `partially_received`/`fully_received` are listed here as structurally
 * legal targets, but in practice they are only ever entered automatically
 * by `receivePurchaseItem`'s internal recompute (see
 * `derivePurchaseReceiptStatus` below) — never by a caller setting status
 * directly, the same way Invoice's `partially_paid`/`paid` are only reached
 * through payment application, never a direct setter.
 */
const PURCHASE_TRANSITIONS: Record<PurchaseStatus, PurchaseStatus[]> = {
  draft: ["submitted", "cancelled", "archived"],
  submitted: ["partially_received", "fully_received", "cancelled", "archived"],
  partially_received: ["fully_received", "cancelled", "archived"],
  fully_received: ["archived"],
  cancelled: ["archived"],
  archived: ["draft"],
};

export function canTransitionPurchaseStatus(from: PurchaseStatus, to: PurchaseStatus): boolean {
  if (from === to) return false;
  return PURCHASE_TRANSITIONS[from].includes(to);
}

/**
 * A Purchase's header (vendor_reference/notes/expected_delivery_date/tax/
 * shipping/discount) may only be edited while draft or submitted — once
 * receiving has begun (partially_received) the order that was actually
 * placed shouldn't keep changing underneath the receipt records, and a
 * cancelled/archived Purchase is frozen outright. Deliberately simpler than
 * a real PO-amendment workflow — out of scope for this Foundation phase.
 */
export function canEditPurchase(status: PurchaseStatus): boolean {
  return status === "draft" || status === "submitted";
}

/**
 * Line items may only be added, edited, or removed while the Purchase is
 * still a draft — once submitted, the order that was placed is fixed, and
 * any further change to quantities/costs has to happen through receiving
 * (`receivePurchaseItem`) rather than editing the line itself.
 */
export function canEditPurchaseItems(status: PurchaseStatus): boolean {
  return status === "draft";
}

/** A line item may be removed only while its Purchase is a draft AND nothing has been received against it yet — matches ContractExhibit's hard-delete precedent, but only while the line has no receiving history to lose. */
export function canRemovePurchaseItem(purchaseStatus: PurchaseStatus, quantityReceived: number): boolean {
  return purchaseStatus === "draft" && quantityReceived === 0;
}

/** Receiving is only meaningful once an order has actually been placed and hasn't been cancelled/archived/already fully received. */
export function canReceivePurchase(status: PurchaseStatus): boolean {
  return status === "submitted" || status === "partially_received";
}

/** Non-negative, matching validateInventoryQuantities' style of a human-readable reason or null. */
export function validateMoneyAmount(amountMinor: number, label: string): string | null {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    return `${label} must be a non-negative whole number of minor units.`;
  }
  return null;
}

/** Ordered must be positive (enforced at the schema level too); received must be within [0, ordered] — the "over-receipt rejection" rule. */
export function validatePurchaseItemQuantities(quantityOrdered: number, quantityReceived: number): string | null {
  if (!Number.isInteger(quantityOrdered) || quantityOrdered <= 0) {
    return "Quantity ordered must be a positive whole number.";
  }
  if (!Number.isInteger(quantityReceived) || quantityReceived < 0) {
    return "Quantity received cannot be negative.";
  }
  if (quantityReceived > quantityOrdered) {
    return "Quantity received cannot exceed quantity ordered.";
  }
  return null;
}

export function computeLineSubtotal(unitCostMinor: number, quantityOrdered: number): number {
  return unitCostMinor * quantityOrdered;
}

/** Sum of every line's subtotal — the Purchase's own subtotal_minor is always this, recomputed on every item add/update/remove, never caller-supplied. */
export function computePurchaseSubtotal(items: Pick<PurchaseItem, "line_subtotal_minor">[]): number {
  return sumMinor(items.map((item) => item.line_subtotal_minor));
}

export function computePurchaseTotal(subtotalMinor: number, taxMinor: number, shippingMinor: number, discountMinor: number): number {
  return subtractMinor(addMinor(addMinor(subtotalMinor, taxMinor), shippingMinor), discountMinor);
}

export type PurchaseReceiptState = "not_started" | "partially_received" | "fully_received";

/**
 * The single source of truth for whether a Purchase counts as not-started,
 * partially received, or fully received — derived from the line items'
 * quantities, never stored independently of them. A Purchase with zero
 * items is "not_started" (there is nothing to receive yet). Mirrors
 * Invoice's `applyPaymentToInvoice`: recomputed from the child ledger every
 * time it changes, rather than incrementally patched.
 */
export function derivePurchaseReceiptStatus(items: Pick<PurchaseItem, "quantity_ordered" | "quantity_received">[]): PurchaseReceiptState {
  if (items.length === 0) return "not_started";

  const totalOrdered = items.reduce((sum, item) => sum + item.quantity_ordered, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.quantity_received, 0);

  if (totalReceived <= 0) return "not_started";
  if (totalReceived >= totalOrdered) return "fully_received";
  return "partially_received";
}
