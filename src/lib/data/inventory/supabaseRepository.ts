import type { InventoryRepository } from "@/lib/data/inventory/repository";

/**
 * Typed placeholder only — there is no `inventory_items`/`inventory_movements`
 * table yet (no migration has been written or applied for Inventory this
 * phase). Every method throws immediately and loudly rather than querying a
 * table that doesn't exist, and rather than silently falling back to mock
 * data while `NEXT_PUBLIC_DATA_MODE=supabase` — either of those would hide a
 * real gap behind what looks like working code.
 *
 * Replace this file's contents with a real implementation (matching
 * `clients/supabaseRepository.ts`'s shape) once the Inventory migration
 * phase creates the underlying tables, RLS, and triggers.
 */
const NOT_YET_MIGRATED_MESSAGE =
  "Inventory has not been migrated to Supabase yet. This placeholder repository is selected whenever NEXT_PUBLIC_DATA_MODE=supabase; complete the Inventory migration phase (tables, RLS, triggers) and replace this file before Inventory is used in supabase data mode.";

function notYetMigrated(): never {
  throw new Error(NOT_YET_MIGRATED_MESSAGE);
}

export const supabaseInventoryRepository: InventoryRepository = {
  listInventoryItems: () => notYetMigrated(),
  getInventoryItem: () => notYetMigrated(),
  createInventoryItem: () => notYetMigrated(),
  updateInventoryItem: () => notYetMigrated(),
  archiveInventoryItem: () => notYetMigrated(),
  restoreInventoryItem: () => notYetMigrated(),
  recordInventoryMovement: () => notYetMigrated(),
  listInventoryMovements: () => notYetMigrated(),
  getInventoryAvailability: () => notYetMigrated(),
  getLowStockItems: () => notYetMigrated(),
  getDamagedOrUnderRepairItems: () => notYetMigrated(),
};
