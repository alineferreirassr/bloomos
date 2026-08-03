import type { InventoryItemType } from "@/core/enums/inventoryItemType";
import type { InventoryStatus } from "@/core/enums/inventoryStatus";
import type { InventoryCondition } from "@/core/enums/inventoryCondition";

/**
 * A physical or reusable asset Amoré Bloom uses to produce Events — flowers,
 * candles, vases, arches, tableware, lighting, and so on. Covers both
 * `consumable` items (bought once, used up) and `reusable` items (bought
 * once, checked out/returned across many Events).
 *
 * `quantity_on_hand`/`quantity_available`/`quantity_reserved` are a
 * snapshot derived from `InventoryMovement` history, never written to
 * directly outside the repository's own movement-recording functions — see
 * docs/inventory.md's "Quantity semantics" section.
 *
 * Money fields are integer minor units (cents), matching `lib/money.ts` and
 * every Finance type — never a float.
 */
export interface InventoryItem {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  sku: string | null;
  /** Curated free text (e.g. Flowers, Candles, Furniture) — no canonical enum yet, matching Client.source's precedent. */
  category: string | null;
  subcategory: string | null;
  item_type: InventoryItemType;

  tags: string[];
  status: InventoryStatus;
  /** Always null for a `consumable` item — condition only applies to something reused across Events. */
  condition: InventoryCondition | null;
  /** Curated free text (e.g. "stem", "each", "box of 12") — no canonical enum yet. */
  unit_of_measure: string | null;

  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
  reorder_level: number | null;
  target_stock_level: number | null;

  unit_cost: number | null;
  replacement_cost: number | null;
  rental_value: number | null;

  storage_location: string | null;
  bin_location: string | null;

  /** Reserved for the future Vendors module — no FK enforced yet. */
  primary_vendor_id: string | null;
  purchase_date: string | null;
  last_inventory_check_at: string | null;
  /** A lightweight scalar note, distinct from the structured Core Notes system every EntityType already supports via owner_type. */
  notes: string | null;
  image_url: string | null;

  created_at: string;
  updated_at: string;
  archived_at: string | null;
}
