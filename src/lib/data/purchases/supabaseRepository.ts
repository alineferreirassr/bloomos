import type { PurchasesRepository } from "@/lib/data/purchases/repository";

/**
 * Typed placeholder only — there is no `purchases`/`purchase_items` table
 * yet (no migration has been written or applied for Purchases this phase,
 * matching Inventory Foundation's own original placeholder precedent
 * exactly). Every method throws immediately and loudly rather than
 * querying a table that doesn't exist, and rather than silently falling
 * back to mock data while `NEXT_PUBLIC_DATA_MODE=supabase` — either of
 * those would hide a real gap behind what looks like working code.
 *
 * Replace this file's contents with a real implementation (matching
 * `inventory/supabaseRepository.ts`'s shape) once the Purchases migration
 * phase creates the underlying tables, RLS, and triggers.
 */
const NOT_YET_MIGRATED_MESSAGE =
  "Purchases has not been migrated to Supabase yet. This placeholder repository is selected whenever NEXT_PUBLIC_DATA_MODE=supabase; complete the Purchases migration phase (tables, RLS, triggers) and replace this file before Purchases is used in supabase data mode.";

function notYetMigrated(): never {
  throw new Error(NOT_YET_MIGRATED_MESSAGE);
}

export const supabasePurchasesRepository: PurchasesRepository = {
  listPurchases: () => notYetMigrated(),
  getPurchase: () => notYetMigrated(),
  createPurchase: () => notYetMigrated(),
  updatePurchase: () => notYetMigrated(),
  submitPurchase: () => notYetMigrated(),
  cancelPurchase: () => notYetMigrated(),
  archivePurchase: () => notYetMigrated(),
  restorePurchase: () => notYetMigrated(),
  listPurchaseItems: () => notYetMigrated(),
  addPurchaseItem: () => notYetMigrated(),
  updatePurchaseItem: () => notYetMigrated(),
  removePurchaseItem: () => notYetMigrated(),
  receivePurchaseItem: () => notYetMigrated(),
  getPurchaseReceiptSummary: () => notYetMigrated(),
  getPurchasesByVendorId: () => notYetMigrated(),
  getOpenPurchases: () => notYetMigrated(),
  getOverduePurchases: () => notYetMigrated(),
  getTimelineByPurchaseId: () => notYetMigrated(),
  getNotesByPurchaseId: () => notYetMigrated(),
  createPurchaseNote: () => notYetMigrated(),
  updatePurchaseNote: () => notYetMigrated(),
  togglePurchaseNotePin: () => notYetMigrated(),
};
