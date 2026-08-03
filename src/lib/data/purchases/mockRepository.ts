import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { PurchaseStatus } from "@/core/enums/purchaseStatus";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import { NotFoundError } from "@/core/errors";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readPurchases, writePurchases } from "@/lib/data/mock/purchasesStore";
import { readPurchaseItems, writePurchaseItems } from "@/lib/data/mock/purchaseItemsStore";
import { readVendors } from "@/lib/data/mock/vendorsStore";
import { readInventoryItems } from "@/lib/data/mock/inventoryItemsStore";
import { mockInventoryRepository } from "@/lib/data/inventory/mockRepository";
import { getCoreTimelineService } from "@/core/timeline";
import { getCoreNotesService } from "@/core/notes";
import { getCoreAuditLogService } from "@/core/audit";
import {
  canTransitionPurchaseStatus,
  canEditPurchase,
  canEditPurchaseItems,
  canRemovePurchaseItem,
  canReceivePurchase,
  validatePurchaseItemQuantities,
  computeLineSubtotal,
  computePurchaseSubtotal,
  computePurchaseTotal,
  derivePurchaseReceiptStatus,
} from "@/core/workflows/purchaseWorkflow";
import {
  createPurchaseInputSchema,
  purchaseInputSchema,
  purchaseItemInputSchema,
  receivePurchaseItemInputSchema,
  type CreatePurchaseInput,
  type PurchaseInput,
  type PurchaseItemInput,
  type ReceivePurchaseItemInput,
} from "@/modules/purchases/schema";
import type { PurchaseFilters, PurchaseReceiptSummary, PurchasesRepository } from "@/lib/data/purchases/repository";

// Purchases' own Timeline vocabulary is registered centrally in
// core/timeline/defaultActivityTypeRegistrations.ts
// (registerDefaultTimelineActivityTypes) — the convention Vendor established
// and the current canonical one, not the older module-scope
// registerTimelineActivityType(...) calls Inventory's mock repository used
// when it was first built. This file only ever consumes the Timeline
// service via getCoreTimelineService(...).recordActivity(...) below.

function fieldErrorsFromZod(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): Partial<Record<string, string>> {
  const fieldErrors: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

function findPurchaseRow(id: string): Purchase | null {
  return readPurchases().find((purchase) => purchase.id === id && purchase.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}

function findPurchaseItemRow(id: string): PurchaseItem | null {
  return readPurchaseItems().find((item) => item.id === id && item.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}

function itemsForPurchase(purchaseId: string): PurchaseItem[] {
  return readPurchaseItems().filter((item) => item.purchase_id === purchaseId && item.workspace_id === CURRENT_WORKSPACE_ID);
}

/** Mirrors generateInvoiceNumber's exact shape (finance/mockRepository.ts) — "PO-{year}-{seq}" instead of "INV-{year}-{seq}". */
function generatePurchaseNumber(workspaceId: string): string {
  const year = new Date().getUTCFullYear();
  const workspacePurchases = readPurchases().filter((purchase) => purchase.workspace_id === workspaceId);
  const existingNumbers = new Set(workspacePurchases.map((purchase) => purchase.purchase_number));

  let sequence = workspacePurchases.length + 1;
  let candidate = `PO-${year}-${String(sequence).padStart(4, "0")}`;
  while (existingNumbers.has(candidate)) {
    sequence += 1;
    candidate = `PO-${year}-${String(sequence).padStart(4, "0")}`;
  }
  return candidate;
}

/**
 * Recomputes subtotal_minor/total_minor from the current item set and
 * persists them — called after every item add/update/remove/receive, the
 * same "recompute from the child ledger, never patch incrementally" shape
 * as Invoice's applyPaymentToInvoice. Also re-derives the receipt-driven
 * status (partially_received/fully_received) whenever the Purchase is
 * already in one of those three statuses — never touches status for a
 * draft (items are still being assembled, nothing to receive yet) or a
 * cancelled/archived Purchase (both are frozen).
 */
function recomputePurchaseAggregates(purchaseId: string): Purchase | null {
  const purchase = findPurchaseRow(purchaseId);
  if (!purchase) return null;
  const items = itemsForPurchase(purchaseId);

  const subtotal_minor = computePurchaseSubtotal(items);
  const total_minor = computePurchaseTotal(subtotal_minor, purchase.tax_minor, purchase.shipping_minor, purchase.discount_minor);

  let status: PurchaseStatus = purchase.status;
  let actual_received_date = purchase.actual_received_date;
  if (purchase.status === "submitted" || purchase.status === "partially_received" || purchase.status === "fully_received") {
    const receiptState = derivePurchaseReceiptStatus(items);
    if (receiptState === "fully_received") {
      status = "fully_received";
      actual_received_date = actual_received_date ?? nowIso();
    } else if (receiptState === "partially_received") {
      status = "partially_received";
      actual_received_date = null;
    } else {
      status = "submitted";
      actual_received_date = null;
    }
  }

  const updated: Purchase = { ...purchase, subtotal_minor, total_minor, status, actual_received_date, updated_at: nowIso() };
  writePurchases(readPurchases().map((p) => (p.id === purchaseId ? updated : p)));
  return updated;
}

async function listPurchases(filters: PurchaseFilters = {}): Promise<Purchase[]> {
  await delay(200);
  const { search, status, vendorId, includeArchived = false } = filters;

  return readPurchases().filter((purchase) => {
    if (purchase.workspace_id !== CURRENT_WORKSPACE_ID) return false;
    if (!includeArchived && purchase.status === "archived") return false;
    if (status && status !== "all" && purchase.status !== status) return false;
    if (vendorId && purchase.vendor_id !== vendorId) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = `${purchase.purchase_number} ${purchase.vendor_reference ?? ""} ${purchase.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });
}

async function getPurchase(id: string): Promise<Purchase> {
  await delay(150);
  const purchase = findPurchaseRow(id);
  if (!purchase) {
    throw new NotFoundError(`Purchase ${id} was not found`);
  }
  return purchase;
}

async function createPurchase(input: CreatePurchaseInput): Promise<DataResult<Purchase>> {
  const parsed = createPurchaseInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const vendor = readVendors().find((v) => v.id === parsed.data.vendor_id && v.workspace_id === CURRENT_WORKSPACE_ID);
  if (!vendor) {
    return fail("Please select a valid vendor.", { vendor_id: "Vendor not found." });
  }

  const { vendor_id, ...fields } = parsed.data;
  const total_minor = computePurchaseTotal(0, fields.tax_minor, fields.shipping_minor, fields.discount_minor);
  if (total_minor < 0) {
    return fail("Total cannot be negative — check tax, shipping, and discount.", { discount_minor: "Discount is larger than the order total." });
  }

  const timestamp = nowIso();
  const purchase: Purchase = {
    id: generateId("purchase"),
    workspace_id: CURRENT_WORKSPACE_ID,
    vendor_id,
    purchase_number: generatePurchaseNumber(CURRENT_WORKSPACE_ID),
    status: "draft",
    order_date: null,
    expected_delivery_date: fields.expected_delivery_date,
    actual_received_date: null,
    currency: fields.currency,
    subtotal_minor: 0,
    tax_minor: fields.tax_minor,
    shipping_minor: fields.shipping_minor,
    discount_minor: fields.discount_minor,
    total_minor,
    notes: fields.notes,
    vendor_reference: fields.vendor_reference,
    created_by: CURRENT_ACTOR,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writePurchases([...readPurchases(), purchase]);

  await getCoreTimelineService().recordActivity(
    purchase.workspace_id,
    "purchase",
    purchase.id,
    CURRENT_ACTOR,
    "purchase_created",
    `Purchase created: "${purchase.purchase_number}"`,
  );
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_created",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: null,
    after: { vendor_id, purchase_number: purchase.purchase_number, status: purchase.status },
  });

  return ok(purchase);
}

async function updatePurchase(id: string, input: PurchaseInput): Promise<DataResult<Purchase>> {
  const existing = findPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (existing.archived_at) {
    return fail("This purchase is archived. Restore it before making changes.");
  }
  if (!canEditPurchase(existing.status)) {
    return fail("This purchase can no longer be edited in its current status.");
  }

  const parsed = purchaseInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const total_minor = computePurchaseTotal(existing.subtotal_minor, parsed.data.tax_minor, parsed.data.shipping_minor, parsed.data.discount_minor);
  if (total_minor < 0) {
    return fail("Total cannot be negative — check tax, shipping, and discount.", { discount_minor: "Discount is larger than the order total." });
  }

  const updated: Purchase = { ...existing, ...parsed.data, total_minor, updated_at: nowIso() };
  writePurchases(readPurchases().map((purchase) => (purchase.id === id ? updated : purchase)));

  await getCoreTimelineService().recordActivity(existing.workspace_id, "purchase", id, CURRENT_ACTOR, "purchase_updated", "Purchase updated");
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_updated",
    ownerType: "purchase",
    ownerId: id,
    before: { tax_minor: existing.tax_minor, shipping_minor: existing.shipping_minor, discount_minor: existing.discount_minor },
    after: { tax_minor: updated.tax_minor, shipping_minor: updated.shipping_minor, discount_minor: updated.discount_minor },
  });

  return ok(updated);
}

async function submitPurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = findPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (!canTransitionPurchaseStatus(existing.status, "submitted")) {
    return fail("This purchase cannot be submitted from its current status.");
  }
  const items = itemsForPurchase(id);
  if (items.length === 0) {
    return fail("Add at least one line item before submitting this purchase.");
  }

  const timestamp = nowIso();
  const updated: Purchase = { ...existing, status: "submitted", order_date: timestamp, updated_at: timestamp };
  writePurchases(readPurchases().map((purchase) => (purchase.id === id ? updated : purchase)));

  await getCoreTimelineService().recordActivity(existing.workspace_id, "purchase", id, CURRENT_ACTOR, "purchase_status_changed", "Purchase submitted to vendor");
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_status_changed",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status },
    after: { status: "submitted" },
  });

  return ok(updated);
}

async function cancelPurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = findPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (!canTransitionPurchaseStatus(existing.status, "cancelled")) {
    return fail("This purchase cannot be cancelled from its current status.");
  }

  const updated: Purchase = { ...existing, status: "cancelled", updated_at: nowIso() };
  writePurchases(readPurchases().map((purchase) => (purchase.id === id ? updated : purchase)));

  await getCoreTimelineService().recordActivity(existing.workspace_id, "purchase", id, CURRENT_ACTOR, "purchase_status_changed", "Purchase cancelled");
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_status_changed",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status },
    after: { status: "cancelled" },
  });

  return ok(updated);
}

async function archivePurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = findPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (existing.archived_at) {
    return fail("This purchase is already archived.");
  }
  if (!canTransitionPurchaseStatus(existing.status, "archived")) {
    return fail("This purchase cannot be archived from its current status.");
  }

  const timestamp = nowIso();
  const updated: Purchase = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writePurchases(readPurchases().map((purchase) => (purchase.id === id ? updated : purchase)));

  await getCoreTimelineService().recordActivity(existing.workspace_id, "purchase", id, CURRENT_ACTOR, "purchase_archived", "Purchase archived");
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_archived",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "archived", archived_at: timestamp },
  });

  return ok(updated);
}

/**
 * Always restores to `draft` — mirrors Invoice's own `archived → draft`
 * simplification exactly (`core/workflows/invoiceWorkflow.ts`), which has
 * the identical property: the underlying money/receipt records
 * (subtotal_minor/total_minor/each item's quantity_received) are untouched
 * and still visible, only the workflow status label resets. A restored
 * Purchase should be treated as needing a fresh look — re-submit it if it's
 * genuinely still an open order — rather than silently resuming wherever it
 * left off, which would otherwise require storing a separate
 * "status before archiving" field this Foundation phase deliberately
 * doesn't add.
 */
async function restorePurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = findPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (!existing.archived_at) {
    return fail("This purchase is not archived.");
  }

  const timestamp = nowIso();
  const updated: Purchase = { ...existing, status: "draft", archived_at: null, updated_at: timestamp };
  writePurchases(readPurchases().map((purchase) => (purchase.id === id ? updated : purchase)));

  await getCoreTimelineService().recordActivity(existing.workspace_id, "purchase", id, CURRENT_ACTOR, "purchase_restored", "Purchase restored");
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_restored",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "draft", archived_at: null },
  });

  return ok(updated);
}

async function listPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  await delay(150);
  return itemsForPurchase(purchaseId).sort((a, b) => a.display_order - b.display_order);
}

async function addPurchaseItem(purchaseId: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  const purchase = findPurchaseRow(purchaseId);
  if (!purchase) {
    return fail("Purchase not found.");
  }
  if (!canEditPurchaseItems(purchase.status)) {
    return fail("Items can only be added while the purchase is a draft.");
  }

  const parsed = purchaseItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  if (parsed.data.inventory_item_id !== null) {
    const inventoryItem = readInventoryItems().find(
      (item) => item.id === parsed.data.inventory_item_id && item.workspace_id === CURRENT_WORKSPACE_ID,
    );
    if (!inventoryItem) {
      return fail("Please select a valid inventory item.", { inventory_item_id: "Inventory item not found." });
    }
  }

  const existingItems = itemsForPurchase(purchaseId);
  const timestamp = nowIso();
  const item: PurchaseItem = {
    id: generateId("purchase_item"),
    workspace_id: purchase.workspace_id,
    purchase_id: purchaseId,
    inventory_item_id: parsed.data.inventory_item_id,
    name: parsed.data.name,
    sku: parsed.data.sku,
    quantity_ordered: parsed.data.quantity_ordered,
    quantity_received: 0,
    unit_cost_minor: parsed.data.unit_cost_minor,
    line_subtotal_minor: computeLineSubtotal(parsed.data.unit_cost_minor, parsed.data.quantity_ordered),
    display_order: existingItems.length,
    created_at: timestamp,
    updated_at: timestamp,
  };

  writePurchaseItems([...readPurchaseItems(), item]);
  recomputePurchaseAggregates(purchaseId);

  await getCoreTimelineService().recordActivity(purchase.workspace_id, "purchase", purchaseId, CURRENT_ACTOR, "purchase_item_added", `Item added: "${item.name}"`);
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_item_added",
    ownerType: "purchase",
    ownerId: purchaseId,
    before: null,
    after: { name: item.name, quantity_ordered: item.quantity_ordered, unit_cost_minor: item.unit_cost_minor },
  });

  return ok(item);
}

async function updatePurchaseItem(id: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  const existing = findPurchaseItemRow(id);
  if (!existing) {
    return fail("Purchase item not found.");
  }
  const purchase = findPurchaseRow(existing.purchase_id);
  if (!purchase) {
    return fail("Purchase not found.");
  }
  if (!canEditPurchaseItems(purchase.status)) {
    return fail("Items can only be edited while the purchase is a draft.");
  }

  const parsed = purchaseItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  if (parsed.data.inventory_item_id !== null) {
    const inventoryItem = readInventoryItems().find(
      (item) => item.id === parsed.data.inventory_item_id && item.workspace_id === CURRENT_WORKSPACE_ID,
    );
    if (!inventoryItem) {
      return fail("Please select a valid inventory item.", { inventory_item_id: "Inventory item not found." });
    }
  }

  const updated: PurchaseItem = {
    ...existing,
    ...parsed.data,
    line_subtotal_minor: computeLineSubtotal(parsed.data.unit_cost_minor, parsed.data.quantity_ordered),
    updated_at: nowIso(),
  };
  writePurchaseItems(readPurchaseItems().map((item) => (item.id === id ? updated : item)));
  recomputePurchaseAggregates(purchase.id);

  await getCoreTimelineService().recordActivity(purchase.workspace_id, "purchase", purchase.id, CURRENT_ACTOR, "purchase_item_updated", `Item updated: "${updated.name}"`);
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_item_updated",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: { name: existing.name, quantity_ordered: existing.quantity_ordered },
    after: { name: updated.name, quantity_ordered: updated.quantity_ordered },
  });

  return ok(updated);
}

async function removePurchaseItem(id: string): Promise<DataResult<null>> {
  const existing = findPurchaseItemRow(id);
  if (!existing) {
    return fail("Purchase item not found.");
  }
  const purchase = findPurchaseRow(existing.purchase_id);
  if (!purchase) {
    return fail("Purchase not found.");
  }
  if (!canRemovePurchaseItem(purchase.status, existing.quantity_received)) {
    return fail("Items can only be removed while the purchase is a draft and nothing has been received against them.");
  }

  writePurchaseItems(readPurchaseItems().filter((item) => item.id !== id));
  recomputePurchaseAggregates(purchase.id);

  await getCoreTimelineService().recordActivity(purchase.workspace_id, "purchase", purchase.id, CURRENT_ACTOR, "purchase_item_removed", `Item removed: "${existing.name}"`);
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_item_removed",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: { name: existing.name, quantity_ordered: existing.quantity_ordered },
    after: null,
  });

  return ok(null);
}

/**
 * The one place receiving happens. For an Inventory-linked line, this calls
 * straight into `mockInventoryRepository.recordInventoryMovement` using the
 * `"purchase"` movement type that already exists in
 * `core/enums/inventoryMovementType.ts` (unused until now) — never a new
 * movement type, and never a re-implementation of
 * `getInventoryMovementDelta`/`validateInventoryQuantities`, both of which
 * stay exactly where they already live. A non-inventory line just updates
 * its own `quantity_received` — there is nothing for Inventory to do.
 * Either way, the parent Purchase's subtotal/total/status are recomputed
 * immediately after via `recomputePurchaseAggregates`, the same
 * "recompute from the child ledger" shape Invoice's own
 * `applyPaymentToInvoice` uses.
 */
async function receivePurchaseItem(id: string, input: ReceivePurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  const parsed = receivePurchaseItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const item = findPurchaseItemRow(id);
  if (!item) {
    return fail("Purchase item not found.");
  }
  const purchase = findPurchaseRow(item.purchase_id);
  if (!purchase) {
    return fail("Purchase not found.");
  }
  if (!canReceivePurchase(purchase.status)) {
    return fail(
      purchase.status === "cancelled" ? "Cancelled purchases cannot receive stock." : "This purchase cannot receive stock in its current status.",
    );
  }

  const nextReceived = item.quantity_received + parsed.data.quantity_received;
  const quantityError = validatePurchaseItemQuantities(item.quantity_ordered, nextReceived);
  if (quantityError) {
    return fail(quantityError);
  }

  if (item.inventory_item_id) {
    const movementResult = await mockInventoryRepository.recordInventoryMovement(item.inventory_item_id, {
      movement_type: "purchase",
      quantity: parsed.data.quantity_received,
      reason: parsed.data.reason ?? `Received against ${purchase.purchase_number}`,
      reference_type: "purchase",
      reference_id: purchase.id,
    });
    if (!movementResult.success) {
      return movementResult;
    }
  }

  const timestamp = nowIso();
  const updatedItem: PurchaseItem = { ...item, quantity_received: nextReceived, updated_at: timestamp };
  writePurchaseItems(readPurchaseItems().map((i) => (i.id === id ? updatedItem : i)));

  recomputePurchaseAggregates(purchase.id);

  await getCoreTimelineService().recordActivity(
    purchase.workspace_id,
    "purchase",
    purchase.id,
    CURRENT_ACTOR,
    "purchase_item_received",
    `Received ${parsed.data.quantity_received} × "${item.name}"`,
    { purchase_item_id: id, quantity_received: parsed.data.quantity_received },
  );
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "purchase_item_received",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: { quantity_received: item.quantity_received },
    after: { quantity_received: nextReceived },
  });

  return ok(updatedItem);
}

async function getPurchaseReceiptSummary(purchaseId: string): Promise<PurchaseReceiptSummary> {
  await delay(100);
  const purchase = findPurchaseRow(purchaseId);
  if (!purchase) {
    throw new NotFoundError(`Purchase ${purchaseId} was not found`);
  }
  const items = itemsForPurchase(purchaseId);
  const totalOrdered = items.reduce((sum, item) => sum + item.quantity_ordered, 0);
  const totalReceived = items.reduce((sum, item) => sum + item.quantity_received, 0);
  const receiptState = derivePurchaseReceiptStatus(items);

  return {
    totalOrdered,
    totalReceived,
    isFullyReceived: receiptState === "fully_received",
    isPartiallyReceived: receiptState === "partially_received",
  };
}

async function getPurchasesByVendorId(vendorId: string): Promise<Purchase[]> {
  await delay(150);
  return readPurchases().filter((purchase) => purchase.workspace_id === CURRENT_WORKSPACE_ID && purchase.vendor_id === vendorId);
}

async function getOpenPurchases(): Promise<Purchase[]> {
  await delay(150);
  return readPurchases().filter(
    (purchase) => purchase.workspace_id === CURRENT_WORKSPACE_ID && (purchase.status === "submitted" || purchase.status === "partially_received"),
  );
}

async function getOverduePurchases(): Promise<Purchase[]> {
  await delay(150);
  const now = Date.now();
  return readPurchases().filter(
    (purchase) =>
      purchase.workspace_id === CURRENT_WORKSPACE_ID &&
      (purchase.status === "submitted" || purchase.status === "partially_received") &&
      purchase.expected_delivery_date !== null &&
      new Date(purchase.expected_delivery_date).getTime() < now,
  );
}

async function getTimelineByPurchaseId(purchaseId: string): Promise<TimelineActivity[]> {
  const purchase = findPurchaseRow(purchaseId);
  if (!purchase) return [];
  return getCoreTimelineService().getTimelineForOwner(purchase.workspace_id, "purchase", purchaseId);
}

async function getNotesByPurchaseId(purchaseId: string): Promise<Note[]> {
  const purchase = findPurchaseRow(purchaseId);
  if (!purchase) return [];
  return getCoreNotesService().getNotesForOwner(purchase.workspace_id, "purchase", purchaseId);
}

async function createPurchaseNote(purchaseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const purchase = findPurchaseRow(purchaseId);
  if (!purchase) return fail("Purchase not found.");
  return getCoreNotesService().createNoteForOwner(purchase.workspace_id, "purchase", purchaseId, CURRENT_ACTOR, input);
}

async function updatePurchaseNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  return getCoreNotesService().updateNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR, input);
}

async function togglePurchaseNotePin(noteId: string): Promise<DataResult<Note> | null> {
  return getCoreNotesService().togglePinNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR);
}

export const mockPurchasesRepository: PurchasesRepository = {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  submitPurchase,
  cancelPurchase,
  archivePurchase,
  restorePurchase,
  listPurchaseItems,
  addPurchaseItem,
  updatePurchaseItem,
  removePurchaseItem,
  receivePurchaseItem,
  getPurchaseReceiptSummary,
  getPurchasesByVendorId,
  getOpenPurchases,
  getOverduePurchases,
  getTimelineByPurchaseId,
  getNotesByPurchaseId,
  createPurchaseNote,
  updatePurchaseNote,
  togglePurchaseNotePin,
};
