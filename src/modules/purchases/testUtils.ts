import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";

/** Test-only fixture factory — not imported by any app code. */
export function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: "purchase-1",
    workspace_id: "workspace-1",
    vendor_id: "vendor-1",
    purchase_number: "PO-2026-0001",
    status: "draft",
    order_date: null,
    expected_delivery_date: "2026-08-15",
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 5000,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 5000,
    notes: null,
    vendor_reference: null,
    created_by: "Amoré Bloom Team",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    archived_at: null,
    ...overrides,
  };
}

/** Test-only fixture factory — not imported by any app code. */
export function makePurchaseItem(overrides: Partial<PurchaseItem> = {}): PurchaseItem {
  return {
    id: "purchase-item-1",
    workspace_id: "workspace-1",
    purchase_id: "purchase-1",
    inventory_item_id: null,
    name: "Rush processing fee",
    sku: null,
    quantity_ordered: 5,
    quantity_received: 0,
    unit_cost_minor: 1000,
    line_subtotal_minor: 5000,
    display_order: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
