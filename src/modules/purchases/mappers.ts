import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { PurchaseFormValues } from "@/modules/purchases/components/PurchaseForm";
import type { PurchaseItemFormValues } from "@/modules/purchases/components/PurchaseItemForm";
import { minorToMajor } from "@/lib/money";

/** Converts a Purchase record's null/numeric fields into the plain-string shape the form works with — mirrors inventoryItemToFormInput/vendorToFormInput. vendor_id is included but only ever rendered on the create form — it's immutable after creation, so the edit form never reads it back out. */
export function purchaseToFormInput(purchase: Purchase): PurchaseFormValues {
  return {
    vendor_id: purchase.vendor_id,
    expected_delivery_date: purchase.expected_delivery_date ?? "",
    currency: purchase.currency,
    tax_minor: String(minorToMajor(purchase.tax_minor)),
    shipping_minor: String(minorToMajor(purchase.shipping_minor)),
    discount_minor: String(minorToMajor(purchase.discount_minor)),
    notes: purchase.notes ?? "",
    vendor_reference: purchase.vendor_reference ?? "",
  };
}

/** Converts a PurchaseItem record into the plain-string shape PurchaseItemForm works with. */
export function purchaseItemToFormInput(item: PurchaseItem): PurchaseItemFormValues {
  return {
    inventory_item_id: item.inventory_item_id ?? "",
    name: item.name,
    sku: item.sku ?? "",
    quantity_ordered: String(item.quantity_ordered),
    unit_cost_minor: String(minorToMajor(item.unit_cost_minor)),
  };
}

/** Same slice-then-toLocaleDateString approach as formatInventoryDate — handles both a plain "YYYY-MM-DD" and a full ISO timestamp. */
export function formatPurchaseDate(value: string | null): string {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return "—";
  return new Date(year, month - 1, day).toLocaleDateString();
}
