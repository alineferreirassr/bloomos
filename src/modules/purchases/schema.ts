import { z } from "zod";

/**
 * Same `moneyMinor`/`currencyCode` helpers as `modules/finance/schema.ts` —
 * not redeclared differently, just duplicated locally the same way Finance's
 * own file doesn't import Vendor's or Inventory's schema helpers either.
 * Every schema module in this codebase keeps its own copies rather than
 * sharing a `modules/shared/schema.ts` that doesn't otherwise exist.
 */
const moneyMinor = z.number().int("Enter a whole number of minor units").nonnegative("Enter a valid amount");
const positiveInt = z.number().int("Enter a whole number").positive("Enter a number greater than zero");
const currencyCode = z
  .string()
  .trim()
  .length(3, "Use a 3-letter currency code")
  .transform((v) => v.toUpperCase());

/**
 * Shared by create and update. `subtotal_minor`/`total_minor` are
 * deliberately absent — both are always recomputed by the repository
 * (see `core/workflows/purchaseWorkflow.ts`'s `computePurchaseSubtotal`/
 * `computePurchaseTotal`), never accepted from a caller, matching Invoice's
 * own `total_minor` exclusion (`modules/finance/schema.ts`'s own comment on
 * this). `status`/`order_date`/`actual_received_date` are also absent —
 * every status transition goes through its own dedicated repository method
 * (`submitPurchase`, `cancelPurchase`, `archivePurchase`, `restorePurchase`,
 * or the automatic receiving recompute), never a plain field on this input,
 * same as Invoice having no plain status setter. `vendor_id` is only ever
 * part of `createPurchaseInputSchema` — it's immutable after creation
 * (mirrors InvoiceForm's `disableClientChange` precedent at the UI layer;
 * here it's enforced by simply not being a field `purchaseInputSchema`
 * exposes at all).
 */
const purchaseBaseSchema = z.object({
  expected_delivery_date: z.string().trim().nullable(),
  currency: currencyCode,
  tax_minor: moneyMinor,
  shipping_minor: moneyMinor,
  discount_minor: moneyMinor,
  notes: z.string().trim().nullable(),
  vendor_reference: z.string().trim().nullable(),
});

export const purchaseInputSchema = purchaseBaseSchema;
export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export const createPurchaseInputSchema = purchaseBaseSchema.extend({
  vendor_id: z.string().trim().min(1, "Vendor is required"),
});
export type CreatePurchaseInput = z.infer<typeof createPurchaseInputSchema>;

/**
 * One Purchase line. `quantity_received`/`line_subtotal_minor`/
 * `display_order` are absent — all three are assigned by the data layer
 * (quantity_received starts at 0 and only changes via
 * `receivePurchaseItem`; line_subtotal_minor is always
 * `unit_cost_minor * quantity_ordered`; display_order mirrors
 * ContractExhibit's append-at-the-end convention). `inventory_item_id` is
 * nullable — a line doesn't have to reference Inventory at all (a delivery
 * fee, a one-off rental, a service line).
 */
export const purchaseItemInputSchema = z.object({
  inventory_item_id: z.string().trim().nullable(),
  name: z.string().trim().min(1, "Name is required"),
  sku: z.string().trim().nullable(),
  quantity_ordered: positiveInt,
  unit_cost_minor: moneyMinor,
});
export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;

/**
 * Input for receiving stock against one line — mirrors
 * `recordInventoryMovementInputSchema`'s shape (`modules/inventory/schema.ts`)
 * lightly, since a receipt against an Inventory-linked line ultimately
 * becomes exactly that kind of movement. `reference_id`/`reference_type`
 * aren't part of this input — the repository always fills them in with the
 * Purchase's own id/"purchase", never left to the caller.
 */
export const receivePurchaseItemInputSchema = z.object({
  quantity_received: positiveInt,
  reason: z.string().trim().nullable(),
});
export type ReceivePurchaseItemInput = z.infer<typeof receivePurchaseItemInputSchema>;
