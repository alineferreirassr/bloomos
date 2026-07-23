import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { PurchaseStatus } from "@/core/enums/purchaseStatus";
import type { CreatePurchaseInput, PurchaseInput, PurchaseItemInput, ReceivePurchaseItemInput } from "@/modules/purchases/schema";
import type { DataResult } from "@/lib/data/result";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";

export interface PurchaseFilters {
  search?: string;
  status?: PurchaseStatus | "all";
  vendorId?: string;
  includeArchived?: boolean;
}

/**
 * Aggregate receipt state across every line item on one Purchase — the
 * repository-level equivalent of `getInventoryAvailability`, letting a
 * caller check received-vs-ordered without re-deriving it from the raw
 * item list itself. Backed by `core/workflows/purchaseWorkflow.ts`'s
 * `derivePurchaseReceiptStatus`.
 */
export interface PurchaseReceiptSummary {
  totalOrdered: number;
  totalReceived: number;
  isFullyReceived: boolean;
  isPartiallyReceived: boolean;
}

/**
 * The single Purchases persistence contract — implemented once by
 * `lib/data/purchases/mockRepository.ts` and (in a later phase) once by
 * `lib/data/purchases/supabaseRepository.ts`, selected via
 * `lib/data/provider.ts`'s `selectRepository()`, wired through
 * `lib/data/index.ts` — the exact shape every prior module
 * (Vendors/Inventory/Contracts/Finance) already follows.
 *
 * `vendor_id` has no dedicated setter — it's fixed at `createPurchase` and
 * never appears in `PurchaseInput` at all (see `modules/purchases/schema.ts`),
 * so there's nothing to expose here.
 *
 * There is deliberately no generic `setPurchaseStatus` — `submitPurchase`/
 * `cancelPurchase`/`archivePurchase`/`restorePurchase` are the only ways a
 * caller changes status directly; `partially_received`/`fully_received` are
 * never caller-settable at all, only ever reached automatically by
 * `receivePurchaseItem`'s internal recompute. This mirrors Invoice's own
 * repository having no plain status setter
 * (`lib/data/finance/repository.ts`).
 *
 * Items are a separate entity (mirrors ContractExhibit, not an embedded
 * array) — `addPurchaseItem`/`updatePurchaseItem` are only legal while the
 * parent Purchase is a draft (`canEditPurchaseItems`); `removePurchaseItem`
 * is only legal while draft AND nothing has been received against that line
 * yet (`canRemovePurchaseItem`) — enforced by the repository, not just
 * documented here. Removal is a real hard-delete, same as
 * `deleteContractExhibit` — a never-submitted draft line has no historical
 * significance to preserve.
 *
 * `receivePurchaseItem` is the one place quantity_received changes. For an
 * Inventory-linked line, the mock implementation calls straight into
 * `mockInventoryRepository.recordInventoryMovement` with the already-defined
 * `"purchase"` movement type (never a new one) so the two domains never
 * duplicate the delta/validation math — see the mock repository's own doc
 * comment for the exact call. A non-inventory line just updates its own
 * `quantity_received`. Either way, the parent Purchase's `status` (and
 * `actual_received_date` once fully received) is recomputed immediately
 * after, from the full current item set, exactly like Invoice's
 * `applyPaymentToInvoice`.
 *
 * `getTimelineByPurchaseId`/`getNotesByPurchaseId`/`createPurchaseNote`/
 * `updatePurchaseNote`/`togglePurchaseNotePin` are included from this first
 * Foundation phase rather than deferred to a later "UI Foundation" pass —
 * Vendor's own repository shipped these from its very first commit, and
 * that (not Inventory's original, later-amended file) is the current
 * convention this codebase follows for a brand-new domain. All five
 * delegate to Core's Timeline/Notes front doors
 * (`getCoreTimelineService()`/`getCoreNotesService()`), never a
 * Purchases-only store. There is deliberately no `deletePurchaseNote` —
 * Notes are never deleted anywhere in this codebase.
 */
export interface PurchasesRepository {
  listPurchases(filters?: PurchaseFilters): Promise<Purchase[]>;
  getPurchase(id: string): Promise<Purchase>;
  createPurchase(input: CreatePurchaseInput): Promise<DataResult<Purchase>>;
  updatePurchase(id: string, input: PurchaseInput): Promise<DataResult<Purchase>>;
  submitPurchase(id: string): Promise<DataResult<Purchase>>;
  cancelPurchase(id: string): Promise<DataResult<Purchase>>;
  archivePurchase(id: string): Promise<DataResult<Purchase>>;
  restorePurchase(id: string): Promise<DataResult<Purchase>>;

  listPurchaseItems(purchaseId: string): Promise<PurchaseItem[]>;
  addPurchaseItem(purchaseId: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>>;
  updatePurchaseItem(id: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>>;
  removePurchaseItem(id: string): Promise<DataResult<null>>;

  receivePurchaseItem(id: string, input: ReceivePurchaseItemInput): Promise<DataResult<PurchaseItem>>;
  getPurchaseReceiptSummary(purchaseId: string): Promise<PurchaseReceiptSummary>;

  getPurchasesByVendorId(vendorId: string): Promise<Purchase[]>;
  /** Not yet fully received and not cancelled/archived — status in (submitted, partially_received). */
  getOpenPurchases(): Promise<Purchase[]>;
  /** Open (per getOpenPurchases) AND expected_delivery_date has passed. */
  getOverduePurchases(): Promise<Purchase[]>;

  getTimelineByPurchaseId(purchaseId: string): Promise<TimelineActivity[]>;
  getNotesByPurchaseId(purchaseId: string): Promise<Note[]>;
  createPurchaseNote(purchaseId: string, input: NoteFormInput): Promise<DataResult<Note>>;
  updatePurchaseNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null>;
  togglePurchaseNotePin(noteId: string): Promise<DataResult<Note> | null>;
}
