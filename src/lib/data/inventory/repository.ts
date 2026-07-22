import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { InventoryStatus } from "@/core/enums/inventoryStatus";
import type { InventoryItemType } from "@/core/enums/inventoryItemType";
import type { InventoryCondition } from "@/core/enums/inventoryCondition";
import type { CreateInventoryItemInput, InventoryItemInput, RecordInventoryMovementInput } from "@/modules/inventory/schema";
import type { DataResult } from "@/lib/data/result";

export interface InventoryItemFilters {
  search?: string;
  status?: InventoryStatus | "all";
  category?: string | "all";
  itemType?: InventoryItemType | "all";
  condition?: InventoryCondition | "all";
  includeArchived?: boolean;
}

export interface InventoryAvailability {
  quantity_on_hand: number;
  quantity_available: number;
  quantity_reserved: number;
  is_low_stock: boolean;
}

/**
 * The single Inventory persistence contract — implemented once by the mock
 * repository (`lib/data/inventory/mockRepository.ts`) and once by the
 * Supabase repository (`lib/data/inventory/supabaseRepository.ts`, a typed
 * placeholder this phase — no migration exists yet), mirroring the
 * Clients/Documents repository pattern. `lib/data/index.ts` picks between
 * them via `lib/data/provider.ts`'s `selectRepository()`.
 *
 * Quantities are never settable directly on an item outside of creation's
 * `initial_quantity` — every other change is a `recordInventoryMovement`
 * call, so `quantity_on_hand`/`quantity_available`/`quantity_reserved`
 * always have an auditable reason behind them. There is deliberately no
 * `updateInventoryMovement`/`deleteInventoryMovement` — the movement
 * history is append-only at this contract level, the same way
 * `AuditLogRepository` has no update/delete method.
 *
 * No hard-delete method exists for items either — `archiveInventoryItem`/
 * `restoreInventoryItem` is the only lifecycle transition out of/into normal
 * use, matching every other BloomOS module's soft-delete convention.
 */
export interface InventoryRepository {
  listInventoryItems(filters?: InventoryItemFilters): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem>;
  createInventoryItem(input: CreateInventoryItemInput): Promise<DataResult<InventoryItem>>;
  updateInventoryItem(id: string, input: InventoryItemInput): Promise<DataResult<InventoryItem>>;
  archiveInventoryItem(id: string): Promise<DataResult<InventoryItem>>;
  restoreInventoryItem(id: string): Promise<DataResult<InventoryItem>>;

  recordInventoryMovement(inventoryItemId: string, input: RecordInventoryMovementInput): Promise<DataResult<InventoryMovement>>;
  listInventoryMovements(inventoryItemId: string): Promise<InventoryMovement[]>;
  getInventoryAvailability(inventoryItemId: string): Promise<InventoryAvailability>;

  /** Items with a set `reorder_level` whose `quantity_available` has fallen to or below it. */
  getLowStockItems(): Promise<InventoryItem[]>;
  /** Items whose `condition` is `damaged` or `under_repair` — always empty for consumable items, which have no condition. */
  getDamagedOrUnderRepairItems(): Promise<InventoryItem[]>;
}
