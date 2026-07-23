import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { InventoryStatus } from "@/core/enums/inventoryStatus";
import type { InventoryItemType } from "@/core/enums/inventoryItemType";
import type { InventoryCondition } from "@/core/enums/inventoryCondition";
import type { CreateInventoryItemInput, InventoryItemInput, RecordInventoryMovementInput } from "@/modules/inventory/schema";
import type { DataResult } from "@/lib/data/result";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";

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
 * Supabase repository (`lib/data/inventory/supabaseRepository.ts`),
 * mirroring the Clients/Documents/Vendors repository pattern.
 * `lib/data/index.ts` picks between them via `lib/data/provider.ts`'s
 * `selectRepository()`. `recordInventoryMovement` is implemented atomically
 * in Supabase mode via the `record_inventory_movement` Postgres function
 * (see `supabase/migrations/20260731100000_inventory_record_movement_function.sql`),
 * matching the same transactional-RPC approach already used by
 * `create_document_version`/`recompute_invoice_balance`.
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
 *
 * `getTimelineByInventoryItemId`/`getNotesByInventoryItemId`/
 * `createInventoryItemNote`/`updateInventoryItemNote`/
 * `toggleInventoryItemNotePin` mirror Vendor's own additions exactly — both
 * delegate to Core's Timeline/Notes front doors (`getCoreTimelineService()`/
 * `getCoreNotesService()`), which already branch on data mode themselves, so
 * neither repository implementation hand-rolls its own note/timeline
 * storage. There is deliberately no `deleteInventoryItemNote` — Notes are
 * never deleted anywhere in this codebase (no DB delete policy exists for
 * the `notes` table), same invariant Vendor Notes preserved.
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

  getTimelineByInventoryItemId(inventoryItemId: string): Promise<TimelineActivity[]>;
  getNotesByInventoryItemId(inventoryItemId: string): Promise<Note[]>;
  createInventoryItemNote(inventoryItemId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  updateInventoryItemNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null>;
  toggleInventoryItemNotePin(noteId: string): Promise<DataResult<Note> | null>;
}
