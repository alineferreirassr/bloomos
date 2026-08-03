import type { Purchase } from "@/types/purchase";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";

/**
 * Seed fixtures cover every status (draft/submitted/partially_received/
 * fully_received/cancelled/archived), an overdue open Purchase
 * (purchase_2), and more than one Vendor (including vendor_3, itself
 * archived, to confirm Purchases against an inactive Vendor still work) —
 * same "isolated to mock mode, never read by the Supabase repository"
 * convention as every other mock store (see e.g. inventoryItemsStore.ts).
 * Corresponding line items live in purchaseItemsStore.ts.
 */
const SEED_PURCHASES: Purchase[] = [
  {
    id: "purchase_1",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_1",
    purchase_number: "PO-2026-0001",
    status: "draft",
    order_date: null,
    expected_delivery_date: null,
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 30000,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 30000,
    notes: "Restock ahead of the Alvarez wedding — confirm ivory candles ship in one batch.",
    vendor_reference: null,
    created_by: CURRENT_ACTOR,
    created_at: "2026-07-15T09:00:00.000Z",
    updated_at: "2026-07-15T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "purchase_2",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_2",
    purchase_number: "PO-2026-0002",
    status: "submitted",
    order_date: "2026-07-01T09:00:00.000Z",
    expected_delivery_date: "2026-07-10T00:00:00.000Z",
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 12500,
    tax_minor: 625,
    shipping_minor: 1500,
    discount_minor: 0,
    total_minor: 14625,
    notes: null,
    vendor_reference: "CLCO-QUOTE-4471",
    created_by: CURRENT_ACTOR,
    created_at: "2026-07-01T09:00:00.000Z",
    updated_at: "2026-07-01T09:00:00.000Z",
    archived_at: null,
  },
  {
    id: "purchase_3",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_1",
    purchase_number: "PO-2026-0003",
    status: "partially_received",
    order_date: "2026-06-15T09:00:00.000Z",
    expected_delivery_date: "2026-08-01T00:00:00.000Z",
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 420000,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 420000,
    notes: "Arch frames arriving in two shipments; settee is a single delivery.",
    vendor_reference: null,
    created_by: CURRENT_ACTOR,
    created_at: "2026-06-15T09:00:00.000Z",
    updated_at: "2026-07-05T11:00:00.000Z",
    archived_at: null,
  },
  {
    id: "purchase_4",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_2",
    purchase_number: "PO-2026-0004",
    status: "fully_received",
    order_date: "2026-05-20T09:00:00.000Z",
    expected_delivery_date: "2026-06-01T00:00:00.000Z",
    actual_received_date: "2026-05-30T14:00:00.000Z",
    currency: "USD",
    subtotal_minor: 18750,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 1000,
    total_minor: 17750,
    notes: null,
    vendor_reference: "CLCO-INV-2091",
    created_by: CURRENT_ACTOR,
    created_at: "2026-05-20T09:00:00.000Z",
    updated_at: "2026-05-30T14:00:00.000Z",
    archived_at: null,
  },
  {
    id: "purchase_5",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_1",
    purchase_number: "PO-2026-0005",
    status: "cancelled",
    order_date: "2026-06-01T09:00:00.000Z",
    expected_delivery_date: "2026-06-15T00:00:00.000Z",
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 35000,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 35000,
    notes: "Client changed the ceremony arch style — no longer needed.",
    vendor_reference: null,
    created_by: CURRENT_ACTOR,
    created_at: "2026-06-01T09:00:00.000Z",
    updated_at: "2026-06-03T10:00:00.000Z",
    archived_at: null,
  },
  {
    id: "purchase_6",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_2",
    purchase_number: "PO-2026-0006",
    status: "archived",
    order_date: "2026-04-01T09:00:00.000Z",
    expected_delivery_date: "2026-04-10T00:00:00.000Z",
    actual_received_date: "2026-04-09T13:00:00.000Z",
    currency: "USD",
    subtotal_minor: 10000,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 10000,
    notes: null,
    vendor_reference: null,
    created_by: CURRENT_ACTOR,
    created_at: "2026-04-01T09:00:00.000Z",
    updated_at: "2026-04-20T09:00:00.000Z",
    archived_at: "2026-04-20T09:00:00.000Z",
  },
  {
    id: "purchase_7",
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id: "vendor_3",
    purchase_number: "PO-2026-0007",
    status: "submitted",
    order_date: "2026-07-05T09:00:00.000Z",
    expected_delivery_date: "2026-08-15T00:00:00.000Z",
    actual_received_date: null,
    currency: "USD",
    subtotal_minor: 20000,
    tax_minor: 0,
    shipping_minor: 0,
    discount_minor: 0,
    total_minor: 20000,
    notes: "Deposit only — Heritage Linens is winding down, confirm they can still fulfill this.",
    vendor_reference: null,
    created_by: CURRENT_ACTOR,
    created_at: "2026-07-05T09:00:00.000Z",
    updated_at: "2026-07-05T09:00:00.000Z",
    archived_at: null,
  },
];

let purchases: Purchase[] = SEED_PURCHASES.map((purchase) => ({ ...purchase }));

export function readPurchases(): Purchase[] {
  return purchases;
}

export function writePurchases(next: Purchase[]): void {
  purchases = next;
}

/** Test-only: restore the store to its seeded state between test cases. */
export function resetPurchasesStore(): void {
  purchases = SEED_PURCHASES.map((purchase) => ({ ...purchase }));
}
