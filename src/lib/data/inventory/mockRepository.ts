import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import { NotFoundError } from "@/core/errors";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { CURRENT_ACTOR } from "@/core/constants/actor";
import { generateId, nowIso, delay } from "@/lib/data/utils";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { readInventoryItems, writeInventoryItems } from "@/lib/data/mock/inventoryItemsStore";
import { readInventoryMovements, appendInventoryMovement } from "@/lib/data/mock/inventoryMovementsStore";
import { getCoreTimelineService, registerTimelineActivityType } from "@/core/timeline";
import { getCoreNotesService } from "@/core/notes";
import { getCoreAuditLogService } from "@/core/audit";
import { INVENTORY_MOVEMENT_TYPE_LABELS } from "@/core/enums/inventoryMovementType";
import { canTransitionInventoryStatus, validateInventoryQuantities, getInventoryMovementDelta } from "@/core/workflows/inventoryWorkflow";
import {
  createInventoryItemInputSchema,
  inventoryItemInputSchema,
  recordInventoryMovementInputSchema,
  type CreateInventoryItemInput,
  type InventoryItemInput,
  type RecordInventoryMovementInput,
} from "@/modules/inventory/schema";
import type { InventoryAvailability, InventoryItemFilters, InventoryRepository } from "@/lib/data/inventory/repository";

// Registers Inventory's own Timeline vocabulary via the Core registry
// (core/timeline/activityTypeRegistry.ts) instead of editing
// core/enums/timelineActivityType.ts — the exact "register without
// modifying Core" path that registry exists for.
registerTimelineActivityType("inventory_item_created", "Inventory item created");
registerTimelineActivityType("inventory_item_updated", "Inventory item updated");
registerTimelineActivityType("inventory_item_archived", "Inventory item archived");
registerTimelineActivityType("inventory_item_restored", "Inventory item restored");
registerTimelineActivityType("inventory_movement_recorded", "Inventory movement recorded");

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

function findInventoryItemRow(id: string): InventoryItem | null {
  return readInventoryItems().find((item) => item.id === id && item.workspace_id === CURRENT_WORKSPACE_ID) ?? null;
}

const SKU_CONFLICT_MESSAGE = "This SKU is already in use in this workspace.";

/**
 * Mirrors the `inventory_items_workspace_sku_unique` partial unique index
 * (workspace_id, sku) where sku is not null — mock mode has no database
 * constraint to enforce this, so it's checked explicitly here, same
 * approach as vendors/mockRepository.ts's findDuplicateTaxId, returning the
 * exact same field-level conflict message the Supabase repository returns
 * on a real 23505.
 */
function findDuplicateSku(sku: string | null, excludeId?: string): boolean {
  if (!sku) return false;
  return readInventoryItems().some(
    (item) => item.workspace_id === CURRENT_WORKSPACE_ID && item.sku === sku && item.id !== excludeId,
  );
}

async function listInventoryItems(filters: InventoryItemFilters = {}): Promise<InventoryItem[]> {
  await delay(200);
  const { search, status, category, itemType, condition, includeArchived = false, primaryVendorId } = filters;

  return readInventoryItems().filter((item) => {
    if (item.workspace_id !== CURRENT_WORKSPACE_ID) return false;
    if (!includeArchived && item.status === "archived") return false;
    if (status && status !== "all" && item.status !== status) return false;
    if (category && category !== "all" && item.category !== category) return false;
    if (itemType && itemType !== "all" && item.item_type !== itemType) return false;
    if (condition && condition !== "all" && item.condition !== condition) return false;
    if (primaryVendorId && item.primary_vendor_id !== primaryVendorId) return false;
    if (search) {
      const q = search.trim().toLowerCase();
      if (q) {
        const haystack = `${item.name} ${item.sku ?? ""} ${item.category ?? ""} ${item.tags.join(" ")}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
    }
    return true;
  });
}

async function getInventoryItem(id: string): Promise<InventoryItem> {
  await delay(150);
  const item = findInventoryItemRow(id);
  if (!item) {
    throw new NotFoundError(`Inventory item ${id} was not found`);
  }
  return item;
}

/**
 * Shared by `createInventoryItem` (for `initial_quantity`) and
 * `recordInventoryMovement` — the one place a movement is actually applied,
 * so both call sites get the exact same invariant checks and Timeline/Audit
 * Log recording, never two copies of this logic.
 */
async function applyInventoryMovement(
  item: InventoryItem,
  input: RecordInventoryMovementInput,
): Promise<DataResult<{ item: InventoryItem; movement: InventoryMovement }>> {
  if (item.archived_at) {
    return fail("Archived inventory items cannot receive stock movements. Restore it first.");
  }

  const delta = getInventoryMovementDelta(input.movement_type, input.quantity);
  const quantityBefore = item.quantity_on_hand;
  const nextOnHand = item.quantity_on_hand + delta.onHand;
  const nextAvailable = item.quantity_available + delta.available;
  const nextReserved = item.quantity_reserved + delta.reserved;

  const invariantError = validateInventoryQuantities({
    quantity_on_hand: nextOnHand,
    quantity_available: nextAvailable,
    quantity_reserved: nextReserved,
  });
  if (invariantError) {
    return fail(invariantError);
  }

  const timestamp = nowIso();
  const updatedItem: InventoryItem = {
    ...item,
    quantity_on_hand: nextOnHand,
    quantity_available: nextAvailable,
    quantity_reserved: nextReserved,
    updated_at: timestamp,
  };
  writeInventoryItems(readInventoryItems().map((i) => (i.id === item.id ? updatedItem : i)));

  const movement: InventoryMovement = {
    id: generateId("inventory_movement"),
    workspace_id: item.workspace_id,
    inventory_item_id: item.id,
    movement_type: input.movement_type,
    quantity: input.quantity,
    quantity_before: quantityBefore,
    quantity_after: nextOnHand,
    reason: input.reason,
    reference_type: input.reference_type,
    reference_id: input.reference_id,
    performed_by: CURRENT_ACTOR,
    occurred_at: timestamp,
    created_at: timestamp,
  };
  appendInventoryMovement(movement);

  const timeline = getCoreTimelineService();
  await timeline.recordActivity(
    item.workspace_id,
    "inventory_item",
    item.id,
    CURRENT_ACTOR,
    "inventory_movement_recorded",
    `${INVENTORY_MOVEMENT_TYPE_LABELS[input.movement_type]}: ${input.quantity}`,
    { movement_type: input.movement_type, quantity: input.quantity },
  );
  await getCoreAuditLogService().recordAuditEvent(item.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "inventory_movement_recorded",
    ownerType: "inventory_item",
    ownerId: item.id,
    before: { quantity_on_hand: quantityBefore },
    after: { quantity_on_hand: nextOnHand, movement_type: input.movement_type, quantity: input.quantity },
  });

  return ok({ item: updatedItem, movement });
}

async function createInventoryItem(input: CreateInventoryItemInput): Promise<DataResult<InventoryItem>> {
  const parsed = createInventoryItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (findDuplicateSku(parsed.data.sku)) {
    return fail(SKU_CONFLICT_MESSAGE, { sku: SKU_CONFLICT_MESSAGE });
  }

  const { initial_quantity, ...fields } = parsed.data;
  const timestamp = nowIso();
  const item: InventoryItem = {
    id: generateId("inventory_item"),
    workspace_id: CURRENT_WORKSPACE_ID,
    ...fields,
    quantity_on_hand: 0,
    quantity_available: 0,
    quantity_reserved: 0,
    last_inventory_check_at: null,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };

  writeInventoryItems([...readInventoryItems(), item]);

  await getCoreTimelineService().recordActivity(
    item.workspace_id,
    "inventory_item",
    item.id,
    CURRENT_ACTOR,
    "inventory_item_created",
    `Inventory item created: "${item.name}"`,
  );
  await getCoreAuditLogService().recordAuditEvent(item.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "inventory_item_created",
    ownerType: "inventory_item",
    ownerId: item.id,
    before: null,
    after: { name: item.name, item_type: item.item_type, status: item.status },
  });

  let finalItem = item;
  if (initial_quantity > 0) {
    const movementResult = await applyInventoryMovement(item, {
      movement_type: "initial_stock",
      quantity: initial_quantity,
      reason: "Initial stock on creation",
      reference_type: null,
      reference_id: null,
    });
    if (movementResult.success) {
      finalItem = movementResult.data.item;
    }
  }

  return ok(finalItem);
}

async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<DataResult<InventoryItem>> {
  const existing = findInventoryItemRow(id);
  if (!existing) {
    return fail("Inventory item not found.");
  }
  if (existing.archived_at) {
    return fail("This inventory item is archived. Restore it before making changes.");
  }

  const parsed = inventoryItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  if (findDuplicateSku(parsed.data.sku, id)) {
    return fail(SKU_CONFLICT_MESSAGE, { sku: SKU_CONFLICT_MESSAGE });
  }

  if (existing.status !== parsed.data.status && !canTransitionInventoryStatus(existing.status, parsed.data.status)) {
    return fail("That status change isn't allowed here.", { status: "Invalid status transition" });
  }

  const updated: InventoryItem = { ...existing, ...parsed.data, updated_at: nowIso() };
  writeInventoryItems(readInventoryItems().map((item) => (item.id === id ? updated : item)));

  await getCoreTimelineService().recordActivity(
    existing.workspace_id,
    "inventory_item",
    id,
    CURRENT_ACTOR,
    "inventory_item_updated",
    "Inventory item updated",
  );
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "inventory_item_updated",
    ownerType: "inventory_item",
    ownerId: id,
    before: { name: existing.name, status: existing.status },
    after: { name: updated.name, status: updated.status },
  });

  return ok(updated);
}

async function archiveInventoryItem(id: string): Promise<DataResult<InventoryItem>> {
  const existing = findInventoryItemRow(id);
  if (!existing) {
    return fail("Inventory item not found.");
  }
  if (existing.archived_at) {
    return fail("This inventory item is already archived.");
  }

  const timestamp = nowIso();
  const updated: InventoryItem = { ...existing, status: "archived", archived_at: timestamp, updated_at: timestamp };
  writeInventoryItems(readInventoryItems().map((item) => (item.id === id ? updated : item)));

  await getCoreTimelineService().recordActivity(
    existing.workspace_id,
    "inventory_item",
    id,
    CURRENT_ACTOR,
    "inventory_item_archived",
    "Inventory item archived",
  );
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "inventory_item_archived",
    ownerType: "inventory_item",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "archived", archived_at: timestamp },
  });

  return ok(updated);
}

async function restoreInventoryItem(id: string): Promise<DataResult<InventoryItem>> {
  const existing = findInventoryItemRow(id);
  if (!existing) {
    return fail("Inventory item not found.");
  }
  if (!existing.archived_at) {
    return fail("This inventory item is not archived.");
  }

  const updated: InventoryItem = { ...existing, status: "active", archived_at: null, updated_at: nowIso() };
  writeInventoryItems(readInventoryItems().map((item) => (item.id === id ? updated : item)));

  await getCoreTimelineService().recordActivity(
    existing.workspace_id,
    "inventory_item",
    id,
    CURRENT_ACTOR,
    "inventory_item_restored",
    "Inventory item restored",
  );
  await getCoreAuditLogService().recordAuditEvent(existing.workspace_id, {
    actor: CURRENT_ACTOR,
    action: "inventory_item_restored",
    ownerType: "inventory_item",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "active", archived_at: null },
  });

  return ok(updated);
}

async function recordInventoryMovement(
  inventoryItemId: string,
  input: RecordInventoryMovementInput,
): Promise<DataResult<InventoryMovement>> {
  const parsed = recordInventoryMovementInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const item = findInventoryItemRow(inventoryItemId);
  if (!item) {
    return fail("Inventory item not found.");
  }

  const result = await applyInventoryMovement(item, parsed.data);
  if (!result.success) {
    return result;
  }
  return ok(result.data.movement);
}

async function listInventoryMovements(inventoryItemId: string): Promise<InventoryMovement[]> {
  await delay(150);
  return readInventoryMovements()
    .filter((movement) => movement.inventory_item_id === inventoryItemId && movement.workspace_id === CURRENT_WORKSPACE_ID)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

async function getInventoryAvailability(inventoryItemId: string): Promise<InventoryAvailability> {
  const item = await getInventoryItem(inventoryItemId);
  return {
    quantity_on_hand: item.quantity_on_hand,
    quantity_available: item.quantity_available,
    quantity_reserved: item.quantity_reserved,
    is_low_stock: item.reorder_level !== null && item.quantity_available <= item.reorder_level,
  };
}

async function getLowStockItems(): Promise<InventoryItem[]> {
  await delay(150);
  return readInventoryItems().filter(
    (item) =>
      item.workspace_id === CURRENT_WORKSPACE_ID &&
      !item.archived_at &&
      item.reorder_level !== null &&
      item.quantity_available <= item.reorder_level,
  );
}

async function getDamagedOrUnderRepairItems(): Promise<InventoryItem[]> {
  await delay(150);
  return readInventoryItems().filter(
    (item) => item.workspace_id === CURRENT_WORKSPACE_ID && (item.condition === "damaged" || item.condition === "under_repair"),
  );
}

async function getTimelineByInventoryItemId(inventoryItemId: string): Promise<TimelineActivity[]> {
  const item = findInventoryItemRow(inventoryItemId);
  if (!item) return [];
  return getCoreTimelineService().getTimelineForOwner(item.workspace_id, "inventory_item", inventoryItemId);
}

async function getNotesByInventoryItemId(inventoryItemId: string): Promise<Note[]> {
  const item = findInventoryItemRow(inventoryItemId);
  if (!item) return [];
  return getCoreNotesService().getNotesForOwner(item.workspace_id, "inventory_item", inventoryItemId);
}

async function createInventoryItemNote(inventoryItemId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const item = findInventoryItemRow(inventoryItemId);
  if (!item) return fail("Inventory item not found.");
  return getCoreNotesService().createNoteForOwner(item.workspace_id, "inventory_item", inventoryItemId, CURRENT_ACTOR, input);
}

async function updateInventoryItemNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  return getCoreNotesService().updateNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR, input);
}

async function toggleInventoryItemNotePin(noteId: string): Promise<DataResult<Note> | null> {
  return getCoreNotesService().togglePinNoteById(CURRENT_WORKSPACE_ID, noteId, CURRENT_ACTOR);
}

export const mockInventoryRepository: InventoryRepository = {
  listInventoryItems,
  getInventoryItem,
  createInventoryItem,
  updateInventoryItem,
  archiveInventoryItem,
  restoreInventoryItem,
  recordInventoryMovement,
  listInventoryMovements,
  getInventoryAvailability,
  getLowStockItems,
  getDamagedOrUnderRepairItems,
  getTimelineByInventoryItemId,
  getNotesByInventoryItemId,
  createInventoryItemNote,
  updateInventoryItemNote,
  toggleInventoryItemNotePin,
};
