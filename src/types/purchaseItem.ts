/**
 * One line of a Purchase — mirrors ContractExhibit's precedent of a real
 * child entity (own table, own id, `workspace_id` duplicated so RLS can gate
 * on it directly without a join) rather than an embedded array on Purchase.
 *
 * `inventory_item_id` is nullable on purpose: a line can be a real Inventory
 * item being restocked, or a non-inventory expense/supply (delivery fee,
 * one-off rental, a service) that never touches Inventory at all. `sku` is a
 * point-in-time snapshot taken from the linked Inventory item when the line
 * is added (or typed manually for a non-inventory line) — never a live
 * lookup — so a line item's own history stays stable even if the Inventory
 * item's SKU changes later. `name` is likewise a snapshot, never a live
 * join to the Inventory item's `name`.
 *
 * `quantity_received` starts at 0 and only ever changes through
 * `PurchasesRepository.receivePurchaseItem` — never a direct field edit —
 * the same "quantity is movement-controlled, not directly editable"
 * invariant Inventory's own `quantity_on_hand`/`quantity_available`/
 * `quantity_reserved` already enforce.
 *
 * `unit_cost_minor`/`line_subtotal_minor` are integer minor units (cents),
 * matching `lib/money.ts`. `line_subtotal_minor` is always
 * `unit_cost_minor * quantity_ordered` — recomputed, never caller-supplied.
 */
export interface PurchaseItem {
  id: string;
  workspace_id: string;
  purchase_id: string;
  inventory_item_id: string | null;
  name: string;
  sku: string | null;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost_minor: number;
  line_subtotal_minor: number;
  /** Display order among the Purchase's items — same convention as ContractExhibit.display_order. */
  display_order: number;
  created_at: string;
  updated_at: string;
}
