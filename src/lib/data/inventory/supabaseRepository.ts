import type { InventoryItem } from "@/types/inventoryItem";
import type { InventoryMovement } from "@/types/inventoryMovement";
import type { Database } from "@/types/database.types";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { getCoreTimelineService } from "@/core/timeline";
import { getCoreNotesService } from "@/core/notes";
import { getCoreAuditLogService } from "@/core/audit";
import { canTransitionInventoryStatus } from "@/core/workflows/inventoryWorkflow";
import {
  createInventoryItemInputSchema,
  inventoryItemInputSchema,
  recordInventoryMovementInputSchema,
  type CreateInventoryItemInput,
  type InventoryItemInput,
  type RecordInventoryMovementInput,
} from "@/modules/inventory/schema";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapInventoryItemRow, mapInventoryMovementRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { InventoryAvailability, InventoryItemFilters, InventoryRepository } from "@/lib/data/inventory/repository";

const UNIQUE_VIOLATION = "23505";

/**
 * Error codes raised by `record_inventory_movement` (see
 * supabase/migrations/20260731100000_inventory_record_movement_function.sql)
 * — scoped to this file only, same reuse-of-P0001..4 convention already
 * used by documents/supabaseRepository.ts and finance/supabaseRepository.ts
 * for their own RPCs.
 */
const APP_VALIDATION_ERROR_CODES = new Set(["P0001", "P0002", "P0003", "P0004"]);

// Inventory's 5 activity types + display labels are registered centrally in
// core/timeline/defaultActivityTypeRegistrations.ts (registerDefaultTimelineActivityTypes)
// via the mock repository's module-scope registerTimelineActivityType calls
// — this file only ever consumes the Timeline service via
// getCoreTimelineService(...).recordActivity(...) below, never mutating the
// global activity-type registry itself.
//
// Core Audit Log integration: getCoreAuditLogService() is mock-only this
// phase (see core/audit/index.ts's own doc comment — same as core/tags) —
// it does not branch on data mode. Calling it here writes to the same
// in-memory mock store the mock Inventory repository writes to, which is
// not durable in a real Supabase-backed session. This mirrors every other
// Supabase repository in the codebase today (none of them have a durable
// Supabase-side Audit Log to call into yet); it's an existing, disclosed
// Core limitation this phase does not attempt to fix.
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

/** Same rationale as vendors/supabaseRepository.ts's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

function resolveActorName(session: WorkspaceSession): string {
  return session.profile.full_name ?? session.profile.email;
}

/** Internal existence check — returns null rather than throwing, matching every other Supabase repository's fetchXRow pattern. RLS means an item in another Workspace is simply invisible here, not a distinct error case. */
async function fetchInventoryItemRow(id: string): Promise<InventoryItem | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("inventory_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapInventoryItemRow(data) : null;
}

async function insertTimelineActivity(
  supabase: ReturnType<typeof createSupabaseClient>,
  workspaceId: string,
  itemId: string,
  actor: string,
  type: string,
  description: string,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: "inventory_item",
    owner_id: itemId,
    type,
    description,
    actor,
  });
  if (error) throw normalizeSupabaseError(error);
}

async function listInventoryItems(filters: InventoryItemFilters = {}): Promise<InventoryItem[]> {
  const session = await requireWorkspaceSession();
  const { search, status, category, itemType, condition, includeArchived = false, primaryVendorId } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("inventory_items").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (category && category !== "all") {
    query = query.eq("category", category);
  }
  if (itemType && itemType !== "all") {
    query = query.eq("item_type", itemType);
  }
  if (condition && condition !== "all") {
    query = query.eq("condition", condition);
  }
  if (primaryVendorId) {
    query = query.eq("primary_vendor_id", primaryVendorId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  const items = (data ?? []).map(mapInventoryItemRow);

  // Matched in application code, not pushed into SQL — same rationale as
  // vendors/supabaseRepository.ts's getVendors search (a single haystack
  // across name/sku/category/tags has no clean single-query SQL
  // equivalent for the array-substring part).
  const q = search?.trim().toLowerCase();
  if (!q) return items;
  return items.filter((item) => {
    const haystack = `${item.name} ${item.sku ?? ""} ${item.category ?? ""} ${item.tags.join(" ")}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getInventoryItem(id: string): Promise<InventoryItem> {
  const item = await fetchInventoryItemRow(id);
  if (!item) {
    throw new NotFoundError(`Inventory item ${id} was not found`);
  }
  return item;
}

async function createInventoryItem(input: CreateInventoryItemInput): Promise<DataResult<InventoryItem>> {
  const parsed = createInventoryItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { initial_quantity, ...fields } = parsed.data;

  const { data, error } = await supabase
    .from("inventory_items")
    .insert({
      workspace_id: session.workspace.id,
      ...fields,
      quantity_on_hand: 0,
      quantity_available: 0,
      quantity_reserved: 0,
    })
    .select("*")
    .single();

  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return fail("This SKU is already in use in this workspace.", { sku: "This SKU is already in use in this workspace." });
    }
    throw normalizeSupabaseError(error);
  }

  let item = mapInventoryItemRow(data);

  await insertTimelineActivity(supabase, item.workspace_id, item.id, actor, "inventory_item_created", `Inventory item created: "${item.name}"`);
  await getCoreAuditLogService().recordAuditEvent(item.workspace_id, {
    actor,
    action: "inventory_item_created",
    ownerType: "inventory_item",
    ownerId: item.id,
    before: null,
    after: { name: item.name, item_type: item.item_type, status: item.status },
  });

  if (initial_quantity > 0) {
    const movementResult = await applyInventoryMovementViaRpc(supabase, item.id, actor, {
      movement_type: "initial_stock",
      quantity: initial_quantity,
      reason: "Initial stock on creation",
      reference_type: null,
      reference_id: null,
    });
    if (movementResult.success) {
      const refreshed = await fetchInventoryItemRow(item.id);
      if (refreshed) item = refreshed;
    }
  }

  return ok(item);
}

async function updateInventoryItem(id: string, input: InventoryItemInput): Promise<DataResult<InventoryItem>> {
  const existing = await fetchInventoryItemRow(id);
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

  if (existing.status !== parsed.data.status && !canTransitionInventoryStatus(existing.status, parsed.data.status)) {
    return fail("That status change isn't allowed here.", { status: "Invalid status transition" });
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.from("inventory_items").update(parsed.data).eq("id", id).select("*").single();
  if (error) {
    if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
      return fail("This SKU is already in use in this workspace.", { sku: "This SKU is already in use in this workspace." });
    }
    throw normalizeSupabaseError(error);
  }

  const updated = mapInventoryItemRow(data);

  await insertTimelineActivity(supabase, updated.workspace_id, id, actor, "inventory_item_updated", "Inventory item updated");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "inventory_item_updated",
    ownerType: "inventory_item",
    ownerId: id,
    before: { name: existing.name, status: existing.status },
    after: { name: updated.name, status: updated.status },
  });

  return ok(updated);
}

async function archiveInventoryItem(id: string): Promise<DataResult<InventoryItem>> {
  const existing = await fetchInventoryItemRow(id);
  if (!existing) {
    return fail("Inventory item not found.");
  }
  if (existing.archived_at) {
    return fail("This inventory item is already archived.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from("inventory_items")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInventoryItemRow(data);

  await insertTimelineActivity(supabase, updated.workspace_id, id, actor, "inventory_item_archived", "Inventory item archived");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "inventory_item_archived",
    ownerType: "inventory_item",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "archived", archived_at: timestamp },
  });

  return ok(updated);
}

async function restoreInventoryItem(id: string): Promise<DataResult<InventoryItem>> {
  const existing = await fetchInventoryItemRow(id);
  if (!existing) {
    return fail("Inventory item not found.");
  }
  if (!existing.archived_at) {
    return fail("This inventory item is not archived.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .update({ status: "active", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapInventoryItemRow(data);

  await insertTimelineActivity(supabase, updated.workspace_id, id, actor, "inventory_item_restored", "Inventory item restored");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "inventory_item_restored",
    ownerType: "inventory_item",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "active", archived_at: null },
  });

  return ok(updated);
}

/**
 * The one place `record_inventory_movement` (see
 * supabase/migrations/20260731100000_inventory_record_movement_function.sql)
 * is called from — shared by `createInventoryItem`'s `initial_quantity`
 * handling and `recordInventoryMovement` below, exactly mirroring how the
 * mock repository's `applyInventoryMovement` is the one shared internal
 * function both of those call into. Does not itself fetch the updated item;
 * callers that need it re-fetch afterward (see createInventoryItem).
 */
async function applyInventoryMovementViaRpc(
  supabase: ReturnType<typeof createSupabaseClient>,
  inventoryItemId: string,
  actor: string,
  input: RecordInventoryMovementInput,
): Promise<DataResult<InventoryMovement>> {
  const { data, error } = await supabase.rpc("record_inventory_movement", {
    p_inventory_item_id: inventoryItemId,
    p_movement_type: input.movement_type,
    p_quantity: input.quantity,
    p_reason: input.reason,
    p_reference_type: input.reference_type,
    p_reference_id: input.reference_id,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  const movement = mapInventoryMovementRow(data as Database["public"]["Tables"]["inventory_movements"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(movement.workspace_id, {
    actor,
    action: "inventory_movement_recorded",
    ownerType: "inventory_item",
    ownerId: inventoryItemId,
    before: { quantity_on_hand: movement.quantity_before },
    after: { quantity_on_hand: movement.quantity_after, movement_type: movement.movement_type, quantity: movement.quantity },
  });

  return ok(movement);
}

async function recordInventoryMovement(
  inventoryItemId: string,
  input: RecordInventoryMovementInput,
): Promise<DataResult<InventoryMovement>> {
  const parsed = recordInventoryMovementInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  return applyInventoryMovementViaRpc(supabase, inventoryItemId, actor, parsed.data);
}

async function listInventoryMovements(inventoryItemId: string): Promise<InventoryMovement[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_movements")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .eq("inventory_item_id", inventoryItemId)
    .order("occurred_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapInventoryMovementRow);
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

/**
 * The `quantity_available <= reorder_level` comparison is column-to-column,
 * which PostgREST's query builder has no direct operator for — the
 * `inventory_items_workspace_reorder_level_idx` partial index (migration 7
 * of 7) only narrows the DB-side candidate set to "reorder_level is not
 * null"; the actual comparison happens in application code afterward,
 * exactly as that index's own migration comment describes and exactly like
 * the mock repository's equivalent in-memory filter.
 */
async function getLowStockItems(): Promise<InventoryItem[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .is("archived_at", null)
    .not("reorder_level", "is", null);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapInventoryItemRow).filter((item) => item.reorder_level !== null && item.quantity_available <= item.reorder_level);
}

async function getDamagedOrUnderRepairItems(): Promise<InventoryItem[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .in("condition", ["damaged", "under_repair"]);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapInventoryItemRow);
}

/**
 * Timeline/Notes reads and note writes delegate to Core's front doors
 * (`getCoreTimelineService`/`getCoreNotesService`), same as
 * vendors/supabaseRepository.ts's equivalents — these already know how to
 * query the real `timeline_activities`/`notes` tables given a Supabase
 * client, so this file never hand-rolls that query itself. Movement/create/
 * update/archive/restore Timeline entries above are written directly via
 * `insertTimelineActivity`/the RPC because those already had their own
 * write path before Notes support existed; only reads and note writes are
 * newly added here.
 */
async function getTimelineByInventoryItemId(inventoryItemId: string): Promise<TimelineActivity[]> {
  const item = await fetchInventoryItemRow(inventoryItemId);
  if (!item) return [];

  const supabase = createSupabaseClient();
  return getCoreTimelineService(supabase).getTimelineForOwner(item.workspace_id, "inventory_item", inventoryItemId);
}

async function getNotesByInventoryItemId(inventoryItemId: string): Promise<Note[]> {
  const item = await fetchInventoryItemRow(inventoryItemId);
  if (!item) return [];

  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).getNotesForOwner(item.workspace_id, "inventory_item", inventoryItemId);
}

async function createInventoryItemNote(inventoryItemId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const item = await fetchInventoryItemRow(inventoryItemId);
  if (!item) return fail("Inventory item not found.");

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).createNoteForOwner(item.workspace_id, "inventory_item", inventoryItemId, resolveActorName(session), input);
}

async function updateInventoryItemNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).updateNoteById(session.workspace.id, noteId, resolveActorName(session), input);
}

async function toggleInventoryItemNotePin(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).togglePinNoteById(session.workspace.id, noteId, resolveActorName(session));
}

export const supabaseInventoryRepository: InventoryRepository = {
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
