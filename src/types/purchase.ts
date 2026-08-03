import type { PurchaseStatus } from "@/core/enums/purchaseStatus";

/**
 * A purchase order placed with a Vendor — the same record represents the
 * whole lifecycle from draft through received (via `status`), matching how
 * Invoice represents draft-through-paid in one row rather than separate
 * "order" and "receipt" entities. Line items live in the separate
 * `PurchaseItem` table (see `types/purchaseItem.ts`), mirroring
 * ContractExhibit's precedent of a real child entity rather than an
 * embedded array.
 *
 * `vendor_id` has no FK yet — same disclosed limitation as
 * `InventoryItem.primary_vendor_id` (see its own doc comment); Vendors and
 * Inventory both predate any real foreign-key enforcement between modules,
 * and Purchases' own migration phase is expected to add real constraints
 * for all three at once.
 *
 * Money fields are integer minor units (cents), matching `lib/money.ts` and
 * every other monetary field in the codebase — never a float.
 *
 * `subtotal_minor`/`total_minor` are never accepted as caller input — they
 * are always recomputed by the repository from the current PurchaseItem set
 * (subtotal) and from subtotal/tax/shipping/discount (total), the same
 * "derived, not trusted from input" rule Invoice's own `total_minor`
 * already follows. `tax_minor`/`shipping_minor`/`discount_minor` ARE
 * caller-supplied — see `core/workflows/purchaseWorkflow.ts` for the exact
 * arithmetic.
 */
export interface Purchase {
  id: string;
  workspace_id: string;
  vendor_id: string;
  /** Generated, unique per workspace — e.g. "PO-2026-0001". Immutable after creation. */
  purchase_number: string;
  status: PurchaseStatus;
  /** Date the order was placed with the Vendor — set when the Purchase is submitted, null while still a draft. */
  order_date: string | null;
  expected_delivery_date: string | null;
  /** Set once `status` reaches `fully_received` — null until then. */
  actual_received_date: string | null;
  currency: string;
  /** Sum of every non-removed PurchaseItem's `line_subtotal_minor` — recomputed on every item add/update/remove. */
  subtotal_minor: number;
  tax_minor: number;
  shipping_minor: number;
  discount_minor: number;
  /** subtotal + tax + shipping - discount — recomputed alongside subtotal_minor. */
  total_minor: number;
  notes: string | null;
  /** The Vendor's own order/quote number or other external reference — free text, not validated against anything. */
  vendor_reference: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
