import type { Purchase } from "@/types/purchase";
import type { PurchaseItem } from "@/types/purchaseItem";
import type { PurchaseStatus } from "@/core/enums/purchaseStatus";
import type { Database } from "@/types/database.types";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { Note } from "@/types/note";
import type { NoteFormInput } from "@/modules/notes/schema";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { getCoreTimelineService } from "@/core/timeline";
import { getCoreNotesService } from "@/core/notes";
import { getCoreAuditLogService } from "@/core/audit";
import {
  canTransitionPurchaseStatus,
  canEditPurchase,
  canEditPurchaseItems,
  canRemovePurchaseItem,
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
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapPurchaseRow, mapPurchaseItemRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { PurchaseFilters, PurchaseReceiptSummary, PurchasesRepository } from "@/lib/data/purchases/repository";

const UNIQUE_VIOLATION = "23505";

/**
 * Error codes raised by `record_purchase_receipt` (see supabase/migrations/
 * 20260802100000_purchases_record_receipt_function.sql) — P0001-P0004 are
 * `record_inventory_movement`'s own codes, forwarded unchanged when that
 * RPC (composed inside record_purchase_receipt) is the one that fails;
 * P0005-P0009 are record_purchase_receipt's own Purchase-level validation.
 * All are treated the same way here (a user-facing `fail(...)`, never
 * thrown) — the distinct ranges exist so a Purchase-level failure is never
 * confused with an Inventory-level one, not because this file branches on
 * which range fired.
 */
const APP_VALIDATION_ERROR_CODES = new Set([
  "P0001",
  "P0002",
  "P0003",
  "P0004",
  "P0005",
  "P0006",
  "P0007",
  "P0008",
  "P0009",
]);

/**
 * No `generate_purchase_number` RPC exists yet (unlike Invoice/Contract,
 * which each have their own number-generating function) — this mirrors
 * Finance's `insertInvoiceWithGeneratedNumber` retry-on-23505 pattern
 * instead, generating a candidate client-side and retrying with a fresh one
 * if a concurrent writer wins the race for that exact number. No new
 * migration was required for this — see docs/purchases.md's Database
 * schema section on why this gap is safe to bridge in TypeScript.
 */
const MAX_PURCHASE_NUMBER_ATTEMPTS = 5;

// Purchases' 9 activity types are registered centrally in
// core/timeline/defaultActivityTypeRegistrations.ts
// (registerDefaultTimelineActivityTypes) — the same convention Vendor
// established. This file only ever consumes the Timeline service via
// getCoreTimelineService(...).recordActivity(...) below, matching Vendor's
// direct-call style rather than Inventory's older bespoke insert helper.
//
// Core Audit Log integration: getCoreAuditLogService() is mock-only this
// phase (see core/audit/index.ts's own doc comment) — it does not branch on
// data mode. Calling it here writes to the same in-memory mock store the
// mock Purchases repository writes to, which is not durable in a real
// Supabase-backed session. This mirrors Inventory's own Supabase repository
// and the Purchases mock repository itself; it's an existing, disclosed
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

/** Same rationale as inventory/supabaseRepository.ts's requireWorkspaceSession. */
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

/** Internal existence check — returns null rather than throwing, matching every other Supabase repository's fetchXRow pattern. RLS means a purchase in another Workspace is simply invisible here, not a distinct error case. */
async function fetchPurchaseRow(id: string): Promise<Purchase | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("purchases").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapPurchaseRow(data) : null;
}

async function fetchPurchaseItemRow(id: string): Promise<PurchaseItem | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("purchase_items").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapPurchaseItemRow(data) : null;
}

async function fetchPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_id", purchaseId)
    .order("display_order", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapPurchaseItemRow);
}

/**
 * Generates a candidate purchase_number ("PO-{year}-{seq}", matching the
 * mock repository's exact format) then inserts. If a concurrent writer won
 * the race for that exact number, the workspace-scoped unique index
 * (purchases_workspace_number_unique) rejects the insert with a 23505; this
 * retries with a freshly generated number — same pattern as Finance's
 * insertInvoiceWithGeneratedNumber/Contracts' insertContractWithGeneratedNumber.
 */
async function insertPurchaseWithGeneratedNumber(
  supabase: ReturnType<typeof createSupabaseClient>,
  workspaceId: string,
  rowWithoutNumber: Omit<Database["public"]["Tables"]["purchases"]["Insert"], "purchase_number">,
): Promise<{ data: Database["public"]["Tables"]["purchases"]["Row"] | null; error: { code?: string } | null }> {
  const year = new Date().getUTCFullYear();

  for (let attempt = 1; attempt <= MAX_PURCHASE_NUMBER_ATTEMPTS; attempt++) {
    const { count, error: countError } = await supabase
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (countError) throw normalizeSupabaseError(countError);

    const sequence = (count ?? 0) + attempt;
    const purchaseNumber = `PO-${year}-${String(sequence).padStart(4, "0")}`;

    const { data, error } = await supabase
      .from("purchases")
      .insert({ ...rowWithoutNumber, purchase_number: purchaseNumber })
      .select("*")
      .single();

    if (!error) return { data, error: null };
    if ((error as { code?: string }).code !== UNIQUE_VIOLATION || attempt === MAX_PURCHASE_NUMBER_ATTEMPTS) {
      return { data: null, error };
    }
    // Unique violation on purchase_number specifically — retry with a freshly generated one.
  }
  // Unreachable — the loop always returns on its final attempt.
  return { data: null, error: { code: "UNKNOWN" } };
}

/**
 * Recomputes subtotal_minor/total_minor from the current item set and
 * persists them — called after every item add/update/remove/receive, the
 * same "recompute from the child ledger, never patch incrementally" shape
 * as the mock repository's own recomputePurchaseAggregates and Invoice's
 * applyPaymentToInvoice/recompute_invoice_balance. Also re-derives the
 * receipt-driven status (partially_received/fully_received) whenever the
 * Purchase is already in one of those three statuses — never touches
 * status for a draft or a cancelled/archived Purchase.
 *
 * Unlike Invoice's equivalent (a single-transaction, row-locking Postgres
 * RPC), this is plain sequential TypeScript — no `recompute_purchase_totals`
 * RPC exists yet. Two receipts against different items of the same Purchase
 * firing concurrently could race here: the last write wins on the
 * aggregate's subtotal/total/status/actual_received_date. This is a narrow,
 * disclosed, self-healing gap, not silently treated as solved — the
 * underlying source of truth (each purchase_items row's own
 * quantity_received) is always correct and immediately consistent, and this
 * function always recomputes fully from that ledger rather than patching
 * incrementally, so any transiently-stale aggregate self-corrects on the
 * very next mutation. See docs/purchases.md's receiving-RPC section.
 */
async function recomputePurchaseAggregates(purchaseId: string): Promise<Purchase | null> {
  const purchase = await fetchPurchaseRow(purchaseId);
  if (!purchase) return null;
  const items = await fetchPurchaseItems(purchaseId);

  const subtotal_minor = computePurchaseSubtotal(items);
  const total_minor = computePurchaseTotal(subtotal_minor, purchase.tax_minor, purchase.shipping_minor, purchase.discount_minor);

  let status: PurchaseStatus = purchase.status;
  let actual_received_date = purchase.actual_received_date;
  if (purchase.status === "submitted" || purchase.status === "partially_received" || purchase.status === "fully_received") {
    const receiptState = derivePurchaseReceiptStatus(items);
    if (receiptState === "fully_received") {
      status = "fully_received";
      actual_received_date = actual_received_date ?? new Date().toISOString();
    } else if (receiptState === "partially_received") {
      status = "partially_received";
      actual_received_date = null;
    } else {
      status = "submitted";
      actual_received_date = null;
    }
  }

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("purchases")
    .update({ subtotal_minor, total_minor, status, actual_received_date })
    .eq("id", purchaseId)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  return mapPurchaseRow(data);
}

async function listPurchases(filters: PurchaseFilters = {}): Promise<Purchase[]> {
  const session = await requireWorkspaceSession();
  const { search, status, vendorId, includeArchived = false } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("purchases").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) {
    query = query.neq("status", "archived");
  }
  if (status && status !== "all") {
    query = query.eq("status", status);
  }
  if (vendorId) {
    query = query.eq("vendor_id", vendorId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);

  const purchases = (data ?? []).map(mapPurchaseRow);

  // Matched in application code, not pushed into SQL — same rationale as
  // inventory/supabaseRepository.ts's/vendors/supabaseRepository.ts's own
  // search (a single haystack across purchase_number/vendor_reference/notes
  // has no clean single-query SQL equivalent).
  const q = search?.trim().toLowerCase();
  if (!q) return purchases;
  return purchases.filter((purchase) => {
    const haystack = `${purchase.purchase_number} ${purchase.vendor_reference ?? ""} ${purchase.notes ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getPurchase(id: string): Promise<Purchase> {
  const purchase = await fetchPurchaseRow(id);
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

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id")
    .eq("id", parsed.data.vendor_id)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (vendorError) throw normalizeSupabaseError(vendorError);
  if (!vendor) {
    return fail("Please select a valid vendor.", { vendor_id: "Vendor not found." });
  }

  const { vendor_id, ...fields } = parsed.data;
  const total_minor = computePurchaseTotal(0, fields.tax_minor, fields.shipping_minor, fields.discount_minor);
  if (total_minor < 0) {
    return fail("Total cannot be negative — check tax, shipping, and discount.", { discount_minor: "Discount is larger than the order total." });
  }

  const { data, error } = await insertPurchaseWithGeneratedNumber(supabase, session.workspace.id, {
    workspace_id: session.workspace.id,
    vendor_id,
    status: "draft",
    order_date: null,
    expected_delivery_date: fields.expected_delivery_date,
    currency: fields.currency,
    subtotal_minor: 0,
    tax_minor: fields.tax_minor,
    shipping_minor: fields.shipping_minor,
    discount_minor: fields.discount_minor,
    total_minor,
    notes: fields.notes,
    vendor_reference: fields.vendor_reference,
    created_by: actor,
  });
  if (error) throw normalizeSupabaseError(error);

  const purchase = mapPurchaseRow(data as Database["public"]["Tables"]["purchases"]["Row"]);

  await getCoreTimelineService(supabase).recordActivity(
    purchase.workspace_id,
    "purchase",
    purchase.id,
    actor,
    "purchase_created",
    `Purchase created: "${purchase.purchase_number}"`,
  );
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor,
    action: "purchase_created",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: null,
    after: { vendor_id, purchase_number: purchase.purchase_number, status: purchase.status },
  });

  return ok(purchase);
}

async function updatePurchase(id: string, input: PurchaseInput): Promise<DataResult<Purchase>> {
  const existing = await fetchPurchaseRow(id);
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

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.from("purchases").update({ ...parsed.data, total_minor }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPurchaseRow(data);

  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "purchase", id, actor, "purchase_updated", "Purchase updated");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "purchase_updated",
    ownerType: "purchase",
    ownerId: id,
    before: { tax_minor: existing.tax_minor, shipping_minor: existing.shipping_minor, discount_minor: existing.discount_minor },
    after: { tax_minor: updated.tax_minor, shipping_minor: updated.shipping_minor, discount_minor: updated.discount_minor },
  });

  return ok(updated);
}

async function submitPurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = await fetchPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (!canTransitionPurchaseStatus(existing.status, "submitted")) {
    return fail("This purchase cannot be submitted from its current status.");
  }

  const supabase = createSupabaseClient();
  const { count, error: countError } = await supabase
    .from("purchase_items")
    .select("id", { count: "exact", head: true })
    .eq("purchase_id", id);
  if (countError) throw normalizeSupabaseError(countError);
  if (!count) {
    return fail("Add at least one line item before submitting this purchase.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from("purchases")
    .update({ status: "submitted", order_date: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPurchaseRow(data);

  await getCoreTimelineService(supabase).recordActivity(
    updated.workspace_id,
    "purchase",
    id,
    actor,
    "purchase_status_changed",
    "Purchase submitted to vendor",
  );
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "purchase_status_changed",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status },
    after: { status: "submitted" },
  });

  return ok(updated);
}

async function cancelPurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = await fetchPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (!canTransitionPurchaseStatus(existing.status, "cancelled")) {
    return fail("This purchase cannot be cancelled from its current status.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.from("purchases").update({ status: "cancelled" }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPurchaseRow(data);

  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "purchase", id, actor, "purchase_status_changed", "Purchase cancelled");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "purchase_status_changed",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status },
    after: { status: "cancelled" },
  });

  return ok(updated);
}

async function archivePurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = await fetchPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (existing.archived_at) {
    return fail("This purchase is already archived.");
  }
  if (!canTransitionPurchaseStatus(existing.status, "archived")) {
    return fail("This purchase cannot be archived from its current status.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();

  const { data, error } = await supabase
    .from("purchases")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPurchaseRow(data);

  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "purchase", id, actor, "purchase_archived", "Purchase archived");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "purchase_archived",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "archived", archived_at: timestamp },
  });

  return ok(updated);
}

/**
 * Always restores to `draft` — mirrors the mock repository's own
 * `restorePurchase` and Invoice's identical `archived -> draft`
 * simplification. See mockRepository.ts's doc comment on this function for
 * the full rationale; this is not a design decision unique to Supabase mode.
 */
async function restorePurchase(id: string): Promise<DataResult<Purchase>> {
  const existing = await fetchPurchaseRow(id);
  if (!existing) {
    return fail("Purchase not found.");
  }
  if (!existing.archived_at) {
    return fail("This purchase is not archived.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase
    .from("purchases")
    .update({ status: "draft", archived_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPurchaseRow(data);

  await getCoreTimelineService(supabase).recordActivity(updated.workspace_id, "purchase", id, actor, "purchase_restored", "Purchase restored");
  await getCoreAuditLogService().recordAuditEvent(updated.workspace_id, {
    actor,
    action: "purchase_restored",
    ownerType: "purchase",
    ownerId: id,
    before: { status: existing.status, archived_at: existing.archived_at },
    after: { status: "draft", archived_at: null },
  });

  return ok(updated);
}

async function listPurchaseItems(purchaseId: string): Promise<PurchaseItem[]> {
  return fetchPurchaseItems(purchaseId);
}

async function addPurchaseItem(purchaseId: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  const purchase = await fetchPurchaseRow(purchaseId);
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

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  if (parsed.data.inventory_item_id !== null) {
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("id", parsed.data.inventory_item_id)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();
    if (inventoryError) throw normalizeSupabaseError(inventoryError);
    if (!inventoryItem) {
      return fail("Please select a valid inventory item.", { inventory_item_id: "Inventory item not found." });
    }
  }

  const { count, error: countError } = await supabase
    .from("purchase_items")
    .select("id", { count: "exact", head: true })
    .eq("purchase_id", purchaseId);
  if (countError) throw normalizeSupabaseError(countError);

  const { data, error } = await supabase
    .from("purchase_items")
    .insert({
      workspace_id: purchase.workspace_id,
      purchase_id: purchaseId,
      inventory_item_id: parsed.data.inventory_item_id,
      name: parsed.data.name,
      sku: parsed.data.sku,
      quantity_ordered: parsed.data.quantity_ordered,
      quantity_received: 0,
      unit_cost_minor: parsed.data.unit_cost_minor,
      line_subtotal_minor: computeLineSubtotal(parsed.data.unit_cost_minor, parsed.data.quantity_ordered),
      display_order: count ?? 0,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const item = mapPurchaseItemRow(data);
  await recomputePurchaseAggregates(purchaseId);

  await getCoreTimelineService(supabase).recordActivity(
    purchase.workspace_id,
    "purchase",
    purchaseId,
    actor,
    "purchase_item_added",
    `Item added: "${item.name}"`,
  );
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor,
    action: "purchase_item_added",
    ownerType: "purchase",
    ownerId: purchaseId,
    before: null,
    after: { name: item.name, quantity_ordered: item.quantity_ordered, unit_cost_minor: item.unit_cost_minor },
  });

  return ok(item);
}

async function updatePurchaseItem(id: string, input: PurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  const existing = await fetchPurchaseItemRow(id);
  if (!existing) {
    return fail("Purchase item not found.");
  }
  const purchase = await fetchPurchaseRow(existing.purchase_id);
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

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  if (parsed.data.inventory_item_id !== null) {
    const { data: inventoryItem, error: inventoryError } = await supabase
      .from("inventory_items")
      .select("id")
      .eq("id", parsed.data.inventory_item_id)
      .eq("workspace_id", session.workspace.id)
      .maybeSingle();
    if (inventoryError) throw normalizeSupabaseError(inventoryError);
    if (!inventoryItem) {
      return fail("Please select a valid inventory item.", { inventory_item_id: "Inventory item not found." });
    }
  }

  const { data, error } = await supabase
    .from("purchase_items")
    .update({
      inventory_item_id: parsed.data.inventory_item_id,
      name: parsed.data.name,
      sku: parsed.data.sku,
      quantity_ordered: parsed.data.quantity_ordered,
      unit_cost_minor: parsed.data.unit_cost_minor,
      line_subtotal_minor: computeLineSubtotal(parsed.data.unit_cost_minor, parsed.data.quantity_ordered),
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapPurchaseItemRow(data);
  await recomputePurchaseAggregates(purchase.id);

  await getCoreTimelineService(supabase).recordActivity(
    purchase.workspace_id,
    "purchase",
    purchase.id,
    actor,
    "purchase_item_updated",
    `Item updated: "${updated.name}"`,
  );
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor,
    action: "purchase_item_updated",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: { name: existing.name, quantity_ordered: existing.quantity_ordered },
    after: { name: updated.name, quantity_ordered: updated.quantity_ordered },
  });

  return ok(updated);
}

async function removePurchaseItem(id: string): Promise<DataResult<null>> {
  const existing = await fetchPurchaseItemRow(id);
  if (!existing) {
    return fail("Purchase item not found.");
  }
  const purchase = await fetchPurchaseRow(existing.purchase_id);
  if (!purchase) {
    return fail("Purchase not found.");
  }
  if (!canRemovePurchaseItem(purchase.status, existing.quantity_received)) {
    return fail("Items can only be removed while the purchase is a draft and nothing has been received against them.");
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { error } = await supabase.from("purchase_items").delete().eq("id", id);
  if (error) throw normalizeSupabaseError(error);

  await recomputePurchaseAggregates(purchase.id);

  await getCoreTimelineService(supabase).recordActivity(
    purchase.workspace_id,
    "purchase",
    purchase.id,
    actor,
    "purchase_item_removed",
    `Item removed: "${existing.name}"`,
  );
  await getCoreAuditLogService().recordAuditEvent(purchase.workspace_id, {
    actor,
    action: "purchase_item_removed",
    ownerType: "purchase",
    ownerId: purchase.id,
    before: { name: existing.name, quantity_ordered: existing.quantity_ordered },
    after: null,
  });

  return ok(null);
}

/**
 * The one place receiving happens — a thin wrapper around the atomic
 * `record_purchase_receipt` RPC (see supabase/migrations/
 * 20260802100000_purchases_record_receipt_function.sql). That function does
 * everything this method used to do sequentially (validate status/archived/
 * quantity, apply the Inventory movement via the existing
 * `record_inventory_movement` RPC for an Inventory-linked line, update
 * `quantity_received`, recompute the parent Purchase's subtotal/total/
 * status/actual_received_date, and log one Timeline entry) inside a single,
 * row-locked transaction — closing the concurrency gap the previous
 * sequential implementation carried as a disclosed limitation. This
 * function therefore does no pre-validation of its own and never touches
 * `purchase_items`/`purchases`/`timeline_activities` directly; only Audit
 * (mock-only, not a Supabase table the RPC could write to) is still handled
 * here, after a successful RPC call.
 */
async function receivePurchaseItem(id: string, input: ReceivePurchaseItemInput): Promise<DataResult<PurchaseItem>> {
  const parsed = receivePurchaseItemInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("record_purchase_receipt", {
    p_purchase_item_id: id,
    p_quantity_received: parsed.data.quantity_received,
    p_reason: parsed.data.reason,
    p_actor: actor,
    // p_receipt_event_id is now a required, caller-supplied idempotency key
    // (the RPC no longer defaults it server-side). This call site has no
    // concept of a retryable client action yet, so a fresh id per call
    // preserves the exact behavior every call already had before the
    // correction — each submission is its own, distinct receipt event.
    p_receipt_event_id: crypto.randomUUID(),
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  const updatedItem = mapPurchaseItemRow(data as Database["public"]["Tables"]["purchase_items"]["Row"]);

  await getCoreAuditLogService().recordAuditEvent(updatedItem.workspace_id, {
    actor,
    action: "purchase_item_received",
    ownerType: "purchase",
    ownerId: updatedItem.purchase_id,
    before: { quantity_received: updatedItem.quantity_received - parsed.data.quantity_received },
    after: { quantity_received: updatedItem.quantity_received },
  });

  return ok(updatedItem);
}

async function getPurchaseReceiptSummary(purchaseId: string): Promise<PurchaseReceiptSummary> {
  const purchase = await fetchPurchaseRow(purchaseId);
  if (!purchase) {
    throw new NotFoundError(`Purchase ${purchaseId} was not found`);
  }
  const items = await fetchPurchaseItems(purchaseId);
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
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapPurchaseRow);
}

async function getOpenPurchases(): Promise<Purchase[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .in("status", ["submitted", "partially_received"])
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapPurchaseRow);
}

async function getOverduePurchases(): Promise<Purchase[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("purchases")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .in("status", ["submitted", "partially_received"])
    .not("expected_delivery_date", "is", null)
    .lt("expected_delivery_date", now)
    .order("expected_delivery_date", { ascending: true });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapPurchaseRow);
}

/**
 * Timeline/Notes reads and note writes delegate to Core's front doors
 * (`getCoreTimelineService`/`getCoreNotesService`), same as
 * inventory/supabaseRepository.ts's and vendors/supabaseRepository.ts's
 * equivalents — these already know how to query the real
 * `timeline_activities`/`notes` tables given a Supabase client.
 */
async function getTimelineByPurchaseId(purchaseId: string): Promise<TimelineActivity[]> {
  const purchase = await fetchPurchaseRow(purchaseId);
  if (!purchase) return [];

  const supabase = createSupabaseClient();
  return getCoreTimelineService(supabase).getTimelineForOwner(purchase.workspace_id, "purchase", purchaseId);
}

async function getNotesByPurchaseId(purchaseId: string): Promise<Note[]> {
  const purchase = await fetchPurchaseRow(purchaseId);
  if (!purchase) return [];

  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).getNotesForOwner(purchase.workspace_id, "purchase", purchaseId);
}

async function createPurchaseNote(purchaseId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const purchase = await fetchPurchaseRow(purchaseId);
  if (!purchase) return fail("Purchase not found.");

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).createNoteForOwner(purchase.workspace_id, "purchase", purchaseId, resolveActorName(session), input);
}

async function updatePurchaseNote(noteId: string, input: NoteFormInput): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).updateNoteById(session.workspace.id, noteId, resolveActorName(session), input);
}

async function togglePurchaseNotePin(noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  return getCoreNotesService(supabase).togglePinNoteById(session.workspace.id, noteId, resolveActorName(session));
}

export const supabasePurchasesRepository: PurchasesRepository = {
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
