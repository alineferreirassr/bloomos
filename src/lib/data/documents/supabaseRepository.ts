import type { Database } from "@/types/database.types";
import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { Note } from "@/types/note";
import type { TimelineActivity } from "@/types/timelineActivity";
import type { EntityType } from "@/core/enums/entityType";
import type { DocumentCategory } from "@/core/enums/documentCategory";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import { NotFoundError, UnauthorizedError, ForbiddenError } from "@/core/errors";
import { DOCUMENT_STATUS_LABELS, canTransitionDocumentStatus, getDocumentNextRecommendedAction } from "@/core/workflows/documentWorkflow";
import { canMoveFolder, getFolderPath, getFolderChildren } from "@/core/workflows/documentFolderWorkflow";
import {
  documentMetadataInputSchema,
  newDocumentVersionInputSchema,
  documentFolderInputSchema,
  VALID_DOCUMENT_OWNER_TYPES,
  type DocumentMetadataInput,
  type NewDocumentVersionInput,
  type DocumentFolderInput,
} from "@/modules/documents/schema";
import { noteFormSchema, type NoteFormInput } from "@/modules/notes/schema";
import {
  computeDocumentOwnerSummary,
  computeDocumentWorkspaceSummary,
  type DocumentOwnerSummary,
  type DocumentWorkspaceSummary,
} from "@/modules/documents/documentStats";
import { DOCUMENT_FOLDER_TEMPLATES, type FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";
import { type DataResult, ok, fail } from "@/lib/data/result";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapDocumentRow, mapDocumentFolderRow, mapNoteRow, mapTimelineActivityRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type {
  DocumentFilters,
  DocumentFolderFilters,
  DocumentFolderTreeNode,
  DocumentMetadataUpdateInput,
  DocumentReferenceType,
  DocumentsRepository,
} from "@/lib/data/documents/repository";

type SupabaseClient = ReturnType<typeof createSupabaseClient>;
type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
type MediaAssetRow = Database["public"]["Tables"]["media_assets"]["Row"];

const APP_VALIDATION_ERROR_CODES = new Set(["P0001", "P0002", "P0003"]);

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

/** Same rationale as every other supabaseRepository.ts's requireWorkspaceSession. */
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

/** Document/Folder Notes/Timeline are recorded against two different owner types (document/document_folder), parameterized like Finance/Events' insertTimelineActivity. */
async function insertTimelineActivity(
  supabase: SupabaseClient,
  actor: string,
  workspaceId: string,
  ownerType: EntityType,
  ownerId: string,
  type: TimelineActivity["type"],
  description: string,
  metadata?: Record<string, string | number | boolean | null>,
): Promise<void> {
  const { error } = await supabase.from("timeline_activities").insert({
    workspace_id: workspaceId,
    owner_type: ownerType,
    owner_id: ownerId,
    type,
    description,
    actor,
    ...(metadata ? { metadata } : {}),
  });
  if (error) throw normalizeSupabaseError(error);
}

/** Fetches the MediaAsset row a Document row links to, or null when unlinked — used to hydrate the derived file_name/mime_type/size_bytes/storage-path/checksum fields Document itself no longer stores. */
async function fetchMediaAssetRowFor(supabase: SupabaseClient, mediaAssetId: string | null): Promise<MediaAssetRow | null> {
  if (mediaAssetId === null) return null;
  const { data, error } = await supabase.from("media_assets").select("*").eq("id", mediaAssetId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data;
}

async function hydrateDocumentRow(supabase: SupabaseClient, row: DocumentRow): Promise<Document> {
  const mediaAssetRow = await fetchMediaAssetRowFor(supabase, row.media_asset_id);
  return mapDocumentRow(row, mediaAssetRow);
}

/** Batch-hydrates many Document rows with one extra query (not N+1) — fetches every distinct linked MediaAsset once. */
async function hydrateDocumentRows(supabase: SupabaseClient, rows: DocumentRow[]): Promise<Document[]> {
  const mediaAssetIds = [...new Set(rows.map((r) => r.media_asset_id).filter((id): id is string => id !== null))];
  const mediaAssetsById = new Map<string, MediaAssetRow>();
  if (mediaAssetIds.length > 0) {
    const { data, error } = await supabase.from("media_assets").select("*").in("id", mediaAssetIds);
    if (error) throw normalizeSupabaseError(error);
    for (const asset of data ?? []) mediaAssetsById.set(asset.id, asset);
  }
  return rows.map((row) => mapDocumentRow(row, row.media_asset_id ? (mediaAssetsById.get(row.media_asset_id) ?? null) : null));
}

/** Internal existence check — returns null rather than throwing, matching every other Supabase repository's fetchXRow pattern. */
async function fetchDocumentRow(id: string): Promise<Document | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? await hydrateDocumentRow(supabase, data) : null;
}

async function fetchDocumentFolderRow(id: string): Promise<DocumentFolder | null> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("document_folders").select("*").eq("id", id).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  return data ? mapDocumentFolderRow(data) : null;
}

/**
 * Validates the owner and every typed reference field a Document create/
 * version input carries — every referenced table (clients/events/
 * contracts/invoices/payments/expenses/contract_exhibits/document_folders)
 * is live on Supabase, so this queries them directly (RLS-governed, same
 * as every other Supabase repository's own cross-reference checks — see
 * Finance's createInvoice), never through another domain's repository
 * wrapper (that would be circular).
 */
async function validateDocumentOwnerAndReferences(
  supabase: SupabaseClient,
  workspaceId: string,
  input: {
    owner_type: EntityType;
    owner_id: string;
    folder_id: string | null;
    contract_exhibit_id: string | null;
    event_id: string | null;
    client_id: string | null;
    contract_id: string | null;
    invoice_id: string | null;
    payment_id: string | null;
    expense_id: string | null;
  },
): Promise<Partial<Record<string, string>> | null> {
  if (!VALID_DOCUMENT_OWNER_TYPES.includes(input.owner_type)) {
    return { owner_type: "Documents cannot be owned by this entity type yet." };
  }

  if (input.owner_type === "workspace") {
    if (input.owner_id !== workspaceId) return { owner_id: "Unknown Workspace." };
  } else {
    const table = { client: "clients", event: "events", contract: "contracts", invoice: "invoices", payment: "payments", expense: "expenses" }[
      input.owner_type as "client" | "event" | "contract" | "invoice" | "payment" | "expense"
    ];
    const { data, error } = await supabase.from(table).select("id").eq("id", input.owner_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!data) return { owner_id: `${input.owner_type[0].toUpperCase()}${input.owner_type.slice(1)} not found.` };
  }

  if (input.folder_id !== null) {
    const { data: folder, error } = await supabase.from("document_folders").select("*").eq("id", input.folder_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!folder) return { folder_id: "Folder not found." };
    if (folder.owner_type !== input.owner_type || folder.owner_id !== input.owner_id) {
      return { folder_id: "Folder belongs to a different owner." };
    }
  }

  let clientRow: { id: string } | null = null;
  if (input.client_id !== null) {
    const { data, error } = await supabase.from("clients").select("id").eq("id", input.client_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    clientRow = data;
    if (!clientRow) return { client_id: "Client not found." };
  }

  if (input.event_id !== null) {
    const { data: event, error } = await supabase.from("events").select("client_id").eq("id", input.event_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!event) return { event_id: "Event not found." };
    if (input.client_id !== null && event.client_id !== input.client_id) {
      return { event_id: "Event belongs to a different client." };
    }
  }

  if (input.contract_id !== null) {
    const { data: contract, error } = await supabase
      .from("contracts")
      .select("client_id, event_id")
      .eq("id", input.contract_id)
      .maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!contract) return { contract_id: "Contract not found." };
    if (input.client_id !== null && contract.client_id !== input.client_id) {
      return { contract_id: "Contract belongs to a different client." };
    }
    if (contract.event_id !== null && input.event_id !== null && contract.event_id !== input.event_id) {
      return { contract_id: "Contract belongs to a different event." };
    }
  }

  if (input.contract_exhibit_id !== null) {
    const { data, error } = await supabase.from("contract_exhibits").select("id").eq("id", input.contract_exhibit_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!data) return { contract_exhibit_id: "Contract Exhibit not found." };
  }
  if (input.invoice_id !== null) {
    const { data, error } = await supabase.from("invoices").select("id").eq("id", input.invoice_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!data) return { invoice_id: "Invoice not found." };
  }
  if (input.payment_id !== null) {
    const { data, error } = await supabase.from("payments").select("id").eq("id", input.payment_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!data) return { payment_id: "Payment not found." };
  }
  if (input.expense_id !== null) {
    const { data, error } = await supabase.from("expenses").select("id").eq("id", input.expense_id).maybeSingle();
    if (error) throw normalizeSupabaseError(error);
    if (!data) return { expense_id: "Expense not found." };
  }

  return null;
}

function documentReferenceColumn(referenceType: DocumentReferenceType): string {
  return referenceType === "contract_exhibit" ? "contract_exhibit_id" : `${referenceType}_id`;
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

async function getDocuments(filters: DocumentFilters = {}): Promise<Document[]> {
  const session = await requireWorkspaceSession();
  const {
    search,
    ownerType,
    ownerId,
    category,
    status,
    visibility,
    folderId,
    uploadedFrom,
    uploadedTo,
    expiresFrom,
    expiresTo,
    includeArchived = false,
    includeDeleted = false,
    latestVersionOnly = false,
    referenceType,
    referenceId,
    sortBy = "uploaded_at",
    sortDirection = "desc",
  } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("documents").select("*").eq("workspace_id", session.workspace.id);

  if (!includeArchived) query = query.neq("status", "archived");
  if (!includeDeleted) query = query.neq("status", "deleted");
  if (ownerType && ownerType !== "all") query = query.eq("owner_type", ownerType);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (category && category !== "all") query = query.eq("category", category);
  if (status && status !== "all") query = query.eq("status", status);
  if (visibility && visibility !== "all") query = query.eq("visibility", visibility);
  if (folderId !== undefined) query = folderId === null ? query.is("folder_id", null) : query.eq("folder_id", folderId);
  if (uploadedFrom) query = query.gte("uploaded_at", uploadedFrom);
  if (uploadedTo) query = query.lte("uploaded_at", uploadedTo);
  if (expiresFrom) query = query.gte("expires_at", expiresFrom);
  if (expiresTo) query = query.lte("expires_at", expiresTo);
  if (latestVersionOnly) query = query.eq("is_latest_version", true);
  if (referenceType && referenceId) query = query.eq(documentReferenceColumn(referenceType), referenceId);

  const sortColumn = sortBy === "size_bytes" ? "uploaded_at" : sortBy; // size_bytes lives on media_assets, not documents — sort client-side for that one below.
  const { data, error } = await query.order(sortColumn, { ascending: sortDirection === "asc" });
  if (error) throw normalizeSupabaseError(error);

  let documents = await hydrateDocumentRows(supabase, data ?? []);

  if (sortBy === "size_bytes") {
    const direction = sortDirection === "asc" ? 1 : -1;
    documents = [...documents].sort((a, b) => direction * ((a.size_bytes ?? 0) - (b.size_bytes ?? 0)));
  }

  const q = search?.trim().toLowerCase();
  if (!q) return documents;
  return documents.filter((document) => {
    const haystack = `${document.title} ${document.description ?? ""} ${document.file_name ?? ""}`.toLowerCase();
    return haystack.includes(q);
  });
}

async function getDocumentById(id: string): Promise<Document> {
  const document = await fetchDocumentRow(id);
  if (!document) {
    throw new NotFoundError(`Document ${id} was not found`);
  }
  return document;
}

async function createDocumentMetadata(input: DocumentMetadataInput): Promise<DataResult<Document>> {
  const parsed = documentMetadataInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const referenceErrors = await validateDocumentOwnerAndReferences(supabase, session.workspace.id, data);
  if (referenceErrors) {
    return fail("Please fix the highlighted fields.", referenceErrors);
  }

  if (data.media_asset_id !== null) {
    const mediaAsset = await fetchMediaAssetRowFor(supabase, data.media_asset_id);
    if (!mediaAsset) {
      return fail("Please select a valid file.", { media_asset_id: "MediaAsset not found." });
    }
  }

  const { data: row, error } = await supabase
    .from("documents")
    .insert({
      workspace_id: session.workspace.id,
      owner_type: data.owner_type,
      owner_id: data.owner_id,
      folder_id: data.folder_id,
      title: data.title && data.title.length > 0 ? data.title : "Untitled Document",
      description: data.description,
      category: data.category,
      status: "draft",
      visibility: data.visibility,
      media_asset_id: data.media_asset_id,
      contract_exhibit_id: data.contract_exhibit_id,
      event_id: data.event_id,
      client_id: data.client_id,
      contract_id: data.contract_id,
      invoice_id: data.invoice_id,
      payment_id: data.payment_id,
      expense_id: data.expense_id,
      uploaded_by: session.user.id,
      expires_at: data.expires_at,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const document = await hydrateDocumentRow(supabase, row);
  await insertTimelineActivity(supabase, actor, document.workspace_id, "document", document.id, "document_created", `Document uploaded: "${document.title}"`);

  return ok(document);
}

async function updateDocumentMetadata(id: string, input: DocumentMetadataUpdateInput): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }
  if (input.title !== null && input.title.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { title: "Title cannot be blank." });
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const patch: Database["public"]["Tables"]["documents"]["Update"] = {
    title: input.title && input.title.length > 0 ? input.title : existing.title,
    description: input.description,
    category: input.category,
    expires_at: input.expires_at,
  };
  if (input.media_asset_id !== undefined) {
    if (input.media_asset_id !== null) {
      const mediaAsset = await fetchMediaAssetRowFor(supabase, input.media_asset_id);
      if (!mediaAsset) {
        return fail("Please select a valid file.", { media_asset_id: "MediaAsset not found." });
      }
    }
    patch.media_asset_id = input.media_asset_id;
  }

  const { data, error } = await supabase.from("documents").update(patch).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "document",
    id,
    "document_metadata_updated",
    `Document metadata updated: "${updated.title}"`,
  );

  return ok(updated);
}

async function activateDocument(id: string): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "active")) {
    return fail(`Cannot activate a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").update({ status: "active" }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "document", id, "document_activated", "Document activated");

  return ok(updated);
}

/**
 * Delegates the atomic core (row-lock, insert new version, supersede the
 * old one, log both Timeline entries) to create_document_version() — see
 * migration 8's comment. Expected validation failures (errcodes
 * P0001-P0003) are translated into a DataResult fail() rather than
 * thrown, matching the mock's fail()-returning createDocumentVersion.
 */
async function createDocumentVersion(input: NewDocumentVersionInput): Promise<DataResult<Document>> {
  const parsed = newDocumentVersionInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  if (data.media_asset_id !== null) {
    const mediaAsset = await fetchMediaAssetRowFor(supabase, data.media_asset_id);
    if (!mediaAsset) {
      return fail("Please select a valid file.", { media_asset_id: "MediaAsset not found." });
    }
  }

  const { data: row, error } = await supabase.rpc("create_document_version", {
    p_document_id: data.document_id,
    p_media_asset_id: data.media_asset_id,
    p_title: data.title ?? null,
    p_visibility: data.visibility ?? null,
    p_expires_at_provided: data.expires_at !== undefined,
    p_expires_at: data.expires_at ?? null,
    p_uploaded_by: session.user.id,
    p_actor: actor,
  });
  if (error) {
    const code = (error as { code?: string }).code;
    if (code && APP_VALIDATION_ERROR_CODES.has(code)) {
      return fail(error.message);
    }
    throw normalizeSupabaseError(error);
  }

  const newVersion = await hydrateDocumentRow(supabase, row);
  return ok(newVersion);
}

async function archiveDocument(id: string): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "archived")) {
    return fail(`Cannot archive a document that is already ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("documents")
    .update({ status: "archived", archived_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "document", id, "document_archived", "Document archived");

  return ok(updated);
}

async function restoreDocument(id: string): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "active")) {
    return fail(`Cannot restore a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .update({ status: "active", archived_at: null, deleted_at: null })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "document", id, "document_restored", "Document restored");

  return ok(updated);
}

async function softDeleteDocument(id: string): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "deleted")) {
    return fail(`Cannot delete a document that is already ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from("documents")
    .update({ status: "deleted", deleted_at: timestamp })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "document", id, "document_soft_deleted", "Document deleted");

  return ok(updated);
}

async function expireDocument(id: string): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (!canTransitionDocumentStatus(existing.status, "expired")) {
    return fail(`Cannot expire a document that is ${DOCUMENT_STATUS_LABELS[existing.status].toLowerCase()}.`);
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").update({ status: "expired" }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(supabase, resolveActorName(session), updated.workspace_id, "document", id, "document_expired", "Document expired");

  return ok(updated);
}

async function updateDocumentVisibility(id: string, visibility: DocumentVisibility): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").update({ visibility }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "document",
    id,
    "document_visibility_changed",
    `Visibility changed to ${visibility}`,
  );

  return ok(updated);
}

async function moveDocumentToFolder(id: string, folderId: string | null): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(id);
  if (!existing) {
    return fail("Document not found.");
  }
  if (existing.status === "deleted") {
    return fail("This document has been deleted and is read-only.");
  }

  const supabase = createSupabaseClient();
  if (folderId !== null) {
    const folder = await fetchDocumentFolderRow(folderId);
    if (!folder) {
      return fail("Folder not found.");
    }
    if (folder.owner_type !== existing.owner_type || folder.owner_id !== existing.owner_id) {
      return fail("Cannot move a document into a folder belonging to a different owner.");
    }
  }

  const session = await requireWorkspaceSession();
  const { data, error } = await supabase.from("documents").update({ folder_id: folderId }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    updated.workspace_id,
    "document",
    id,
    "document_moved_to_folder",
    "Document moved to a different folder",
  );

  return ok(updated);
}

function documentChainFilter(rootId: string) {
  return `id.eq.${rootId},parent_document_id.eq.${rootId}`;
}

async function getDocumentVersions(documentId: string): Promise<Document[]> {
  const anchor = await fetchDocumentRow(documentId);
  if (!anchor) return [];
  const rootId = anchor.parent_document_id ?? anchor.id;

  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").select("*").or(documentChainFilter(rootId)).order("version", { ascending: true });
  if (error) throw normalizeSupabaseError(error);

  return hydrateDocumentRows(supabase, data ?? []);
}

async function getLatestDocumentVersion(documentId: string): Promise<Document> {
  const versions = await getDocumentVersions(documentId);
  const latest = versions.find((d) => d.is_latest_version);
  if (!latest) {
    throw new NotFoundError(`Document ${documentId} was not found`);
  }
  return latest;
}

async function getDocumentsByOwner(ownerType: EntityType, ownerId: string): Promise<Document[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").select("*").eq("owner_type", ownerType).eq("owner_id", ownerId);
  if (error) throw normalizeSupabaseError(error);
  return hydrateDocumentRows(supabase, data ?? []);
}

async function getDocumentsByCategory(category: DocumentCategory): Promise<Document[]> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .eq("category", category);
  if (error) throw normalizeSupabaseError(error);
  return hydrateDocumentRows(supabase, data ?? []);
}

async function getDocumentsByReference(referenceType: DocumentReferenceType, referenceId: string): Promise<Document[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").select("*").eq(documentReferenceColumn(referenceType), referenceId);
  if (error) throw normalizeSupabaseError(error);
  return hydrateDocumentRows(supabase, data ?? []);
}

async function getDocumentNextAction(documentId: string): Promise<string | null> {
  const document = await getDocumentById(documentId);
  return getDocumentNextRecommendedAction(document);
}

async function getDocumentOwnerSummary(ownerType: EntityType, ownerId: string): Promise<DocumentOwnerSummary> {
  const owned = await getDocumentsByOwner(ownerType, ownerId);
  return computeDocumentOwnerSummary(owned);
}

async function getWorkspaceDocumentSummary(): Promise<DocumentWorkspaceSummary> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").select("*").eq("workspace_id", session.workspace.id);
  if (error) throw normalizeSupabaseError(error);
  const documents = await hydrateDocumentRows(supabase, data ?? []);
  return computeDocumentWorkspaceSummary(documents);
}

// ---------------------------------------------------------------------------
// Placeholder attachment helpers
// ---------------------------------------------------------------------------

async function attachDocumentReference(
  documentId: string,
  patch: Partial<
    Pick<Document, "contract_exhibit_id" | "event_id" | "client_id" | "contract_id" | "invoice_id" | "payment_id" | "expense_id">
  >,
  label: string,
): Promise<DataResult<Document>> {
  const existing = await fetchDocumentRow(documentId);
  if (!existing) {
    return fail("Document not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("documents").update(patch).eq("id", documentId).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = await hydrateDocumentRow(supabase, data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    "document",
    documentId,
    "document_metadata_updated",
    `Document linked to ${label}`,
  );

  return ok(updated);
}

async function attachDocumentToContractExhibit(documentId: string, exhibitId: string): Promise<DataResult<Document>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("contract_exhibits").select("id").eq("id", exhibitId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Contract Exhibit not found.");
  return attachDocumentReference(documentId, { contract_exhibit_id: exhibitId }, `Contract Exhibit ${exhibitId}`);
}

async function attachDocumentToPayment(documentId: string, paymentId: string): Promise<DataResult<Document>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("payments").select("id").eq("id", paymentId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Payment not found.");
  return attachDocumentReference(documentId, { payment_id: paymentId }, `Payment ${paymentId}`);
}

async function attachDocumentToExpense(documentId: string, expenseId: string): Promise<DataResult<Document>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("expenses").select("id").eq("id", expenseId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Expense not found.");
  return attachDocumentReference(documentId, { expense_id: expenseId }, `Expense ${expenseId}`);
}

async function attachDocumentToInvoice(documentId: string, invoiceId: string): Promise<DataResult<Document>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("invoices").select("id").eq("id", invoiceId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Invoice not found.");
  return attachDocumentReference(documentId, { invoice_id: invoiceId }, `Invoice ${invoiceId}`);
}

async function attachDocumentToEvent(documentId: string, eventId: string): Promise<DataResult<Document>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("events").select("id").eq("id", eventId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Event not found.");
  return attachDocumentReference(documentId, { event_id: eventId }, `Event ${eventId}`);
}

async function attachDocumentToClient(documentId: string, clientId: string): Promise<DataResult<Document>> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
  if (error) throw normalizeSupabaseError(error);
  if (!data) return fail("Client not found.");
  return attachDocumentReference(documentId, { client_id: clientId }, `Client ${clientId}`);
}

// ---------------------------------------------------------------------------
// Document Folders
// ---------------------------------------------------------------------------

async function getDocumentFolders(filters: DocumentFolderFilters = {}): Promise<DocumentFolder[]> {
  const session = await requireWorkspaceSession();
  const { ownerType, ownerId, parentFolderId, includeArchived = false } = filters;

  const supabase = createSupabaseClient();
  let query = supabase.from("document_folders").select("*").eq("workspace_id", session.workspace.id);
  if (!includeArchived) query = query.is("archived_at", null);
  if (ownerType) query = query.eq("owner_type", ownerType);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (parentFolderId !== undefined) {
    query = parentFolderId === null ? query.is("parent_folder_id", null) : query.eq("parent_folder_id", parentFolderId);
  }

  const { data, error } = await query;
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapDocumentFolderRow);
}

async function getDocumentFolderById(id: string): Promise<DocumentFolder> {
  const folder = await fetchDocumentFolderRow(id);
  if (!folder) {
    throw new NotFoundError(`Document folder ${id} was not found`);
  }
  return folder;
}

async function createDocumentFolder(input: DocumentFolderInput): Promise<DataResult<DocumentFolder>> {
  const parsed = documentFolderInputSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }
  const data = parsed.data;

  if (!VALID_DOCUMENT_OWNER_TYPES.includes(data.owner_type)) {
    return fail("Please fix the highlighted fields.", { owner_type: "Folders cannot be owned by this entity type yet." });
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  if (data.parent_folder_id !== null) {
    const parent = await fetchDocumentFolderRow(data.parent_folder_id);
    if (!parent) {
      return fail("Please fix the highlighted fields.", { parent_folder_id: "Parent folder not found." });
    }
    if (parent.owner_type !== data.owner_type || parent.owner_id !== data.owner_id) {
      return fail("Please fix the highlighted fields.", {
        parent_folder_id: "Parent folder belongs to a different owner.",
      });
    }
  }

  const { data: row, error } = await supabase
    .from("document_folders")
    .insert({ workspace_id: session.workspace.id, ...data })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const folder = mapDocumentFolderRow(row);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    folder.workspace_id,
    "document_folder",
    folder.id,
    "document_folder_created",
    `Folder created: "${folder.name}"`,
  );

  return ok(folder);
}

async function updateDocumentFolder(
  id: string,
  input: { name: string; description: string | null; sort_order: number; visibility: DocumentVisibility },
): Promise<DataResult<DocumentFolder>> {
  const existing = await fetchDocumentFolderRow(id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (input.name.trim().length === 0) {
    return fail("Please fix the highlighted fields.", { name: "Folder name is required." });
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("document_folders").update(input).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapDocumentFolderRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    "document_folder",
    id,
    "document_folder_renamed",
    `Folder updated: "${updated.name}"`,
  );

  return ok(updated);
}

async function moveDocumentFolder(id: string, newParentFolderId: string | null): Promise<DataResult<DocumentFolder>> {
  const existing = await fetchDocumentFolderRow(id);
  if (!existing) {
    return fail("Folder not found.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data: siblingRows, error: siblingError } = await supabase
    .from("document_folders")
    .select("*")
    .eq("workspace_id", existing.workspace_id)
    .eq("owner_type", existing.owner_type)
    .eq("owner_id", existing.owner_id);
  if (siblingError) throw normalizeSupabaseError(siblingError);

  const check = canMoveFolder(existing, newParentFolderId, (siblingRows ?? []).map(mapDocumentFolderRow));
  if (!check.allowed) {
    return fail(check.reason ?? "This move is not allowed.");
  }

  const { data, error } = await supabase
    .from("document_folders")
    .update({ parent_folder_id: newParentFolderId })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapDocumentFolderRow(data);
  await insertTimelineActivity(supabase, resolveActorName(session), existing.workspace_id, "document_folder", id, "document_folder_moved", "Folder moved");

  return ok(updated);
}

async function archiveDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  const existing = await fetchDocumentFolderRow(id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (existing.archived_at !== null) {
    return fail("This folder is already archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const timestamp = new Date().toISOString();
  const { data, error } = await supabase.from("document_folders").update({ archived_at: timestamp }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapDocumentFolderRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    "document_folder",
    id,
    "document_folder_archived",
    "Folder archived",
  );

  return ok(updated);
}

async function restoreDocumentFolder(id: string): Promise<DataResult<DocumentFolder>> {
  const existing = await fetchDocumentFolderRow(id);
  if (!existing) {
    return fail("Folder not found.");
  }
  if (existing.archived_at === null) {
    return fail("This folder is not archived.");
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("document_folders").update({ archived_at: null }).eq("id", id).select("*").single();
  if (error) throw normalizeSupabaseError(error);

  const updated = mapDocumentFolderRow(data);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    existing.workspace_id,
    "document_folder",
    id,
    "document_folder_restored",
    "Folder restored",
  );

  return ok(updated);
}

function buildFolderTree(parentFolderId: string | null, allFolders: DocumentFolder[]): DocumentFolderTreeNode[] {
  return getFolderChildren(parentFolderId, allFolders).map((folder) => ({
    folder,
    children: buildFolderTree(folder.id, allFolders),
  }));
}

async function getDocumentFolderTree(ownerType: EntityType, ownerId: string): Promise<DocumentFolderTreeNode[]> {
  const supabase = createSupabaseClient();
  const { data, error } = await supabase.from("document_folders").select("*").eq("owner_type", ownerType).eq("owner_id", ownerId);
  if (error) throw normalizeSupabaseError(error);
  return buildFolderTree(null, (data ?? []).map(mapDocumentFolderRow));
}

async function getDocumentFolderPath(id: string): Promise<DocumentFolder[]> {
  const folder = await fetchDocumentFolderRow(id);
  if (!folder) return [];

  const supabase = createSupabaseClient();
  const { data, error } = await supabase
    .from("document_folders")
    .select("*")
    .eq("workspace_id", folder.workspace_id)
    .eq("owner_type", folder.owner_type)
    .eq("owner_id", folder.owner_id);
  if (error) throw normalizeSupabaseError(error);

  return getFolderPath(id, (data ?? []).map(mapDocumentFolderRow));
}

/** Delegates to apply_default_folder_template() for atomic bulk-insert + one summarized Timeline entry — see migration 8's comment. */
async function applyDefaultFolderTemplate(input: {
  ownerType: EntityType;
  ownerId: string;
  templateKind: FolderTemplateKind;
  parentFolderId?: string | null;
}): Promise<DataResult<DocumentFolder[]>> {
  const names = DOCUMENT_FOLDER_TEMPLATES[input.templateKind];
  const session = await requireWorkspaceSession();
  const actor = resolveActorName(session);
  const supabase = createSupabaseClient();

  const { data, error } = await supabase.rpc("apply_default_folder_template", {
    p_workspace_id: session.workspace.id,
    p_owner_type: input.ownerType,
    p_owner_id: input.ownerId,
    p_names: names,
    p_parent_folder_id: input.parentFolderId ?? null,
    p_actor: actor,
    p_template_kind: input.templateKind,
  });
  if (error) throw normalizeSupabaseError(error);

  const rows = data as unknown as Database["public"]["Tables"]["document_folders"]["Row"][];
  return ok(rows.map(mapDocumentFolderRow));
}

// ---------------------------------------------------------------------------
// Document / Document Folder Notes and Timeline
// ---------------------------------------------------------------------------

async function fetchNotesForOwner(supabase: SupabaseClient, ownerType: EntityType, workspaceId: string, ownerId: string): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapNoteRow);
}

async function createNoteForOwner(
  ownerType: EntityType,
  workspaceId: string,
  ownerId: string,
  input: NoteFormInput,
): Promise<DataResult<Note>> {
  const parsed = noteFormSchema.safeParse(input);
  if (!parsed.success) {
    return fail("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();
  const actor = resolveActorName(session);

  const { data, error } = await supabase
    .from("notes")
    .insert({
      workspace_id: workspaceId,
      owner_type: ownerType,
      owner_id: ownerId,
      ...parsed.data,
      is_pinned: false,
      attachments: [],
      created_by: actor,
    })
    .select("*")
    .single();
  if (error) throw normalizeSupabaseError(error);

  const note = mapNoteRow(data);
  await insertTimelineActivity(supabase, actor, workspaceId, ownerType, ownerId, "note_added", `Note added: "${note.title}"`);

  return ok(note);
}

async function togglePinNoteForOwner(ownerType: EntityType, noteId: string): Promise<DataResult<Note> | null> {
  const session = await requireWorkspaceSession();
  const supabase = createSupabaseClient();

  const { data: noteRow, error: fetchError } = await supabase
    .from("notes")
    .select("*")
    .eq("id", noteId)
    .eq("owner_type", ownerType)
    .eq("workspace_id", session.workspace.id)
    .maybeSingle();
  if (fetchError) throw normalizeSupabaseError(fetchError);
  if (!noteRow) return null;

  const note = mapNoteRow(noteRow);
  const nextPinned = !note.is_pinned;
  const { data: updatedRow, error: updateError } = await supabase
    .from("notes")
    .update({ is_pinned: nextPinned })
    .eq("id", noteId)
    .eq("owner_type", ownerType)
    .eq("owner_id", note.owner_id)
    .eq("workspace_id", session.workspace.id)
    .select("*")
    .single();
  if (updateError) throw normalizeSupabaseError(updateError);

  const updated = mapNoteRow(updatedRow);
  await insertTimelineActivity(
    supabase,
    resolveActorName(session),
    note.workspace_id,
    ownerType,
    note.owner_id,
    nextPinned ? "note_pinned" : "note_unpinned",
    `${nextPinned ? "Note pinned" : "Note unpinned"}: "${note.title}"`,
  );

  return ok(updated);
}

async function fetchTimelineForOwner(supabase: SupabaseClient, ownerType: EntityType, workspaceId: string, ownerId: string): Promise<TimelineActivity[]> {
  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("timestamp", { ascending: false });
  if (error) throw normalizeSupabaseError(error);
  return (data ?? []).map(mapTimelineActivityRow);
}

async function getNotesByDocumentId(documentId: string): Promise<Note[]> {
  const document = await fetchDocumentRow(documentId);
  if (!document) return [];
  const supabase = createSupabaseClient();
  return fetchNotesForOwner(supabase, "document", document.workspace_id, documentId);
}

async function createDocumentNote(documentId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const document = await fetchDocumentRow(documentId);
  if (!document) {
    return fail("Document not found.");
  }
  return createNoteForOwner("document", document.workspace_id, documentId, input);
}

async function togglePinDocumentNote(noteId: string): Promise<DataResult<Note> | null> {
  return togglePinNoteForOwner("document", noteId);
}

async function getTimelineByDocumentId(documentId: string): Promise<TimelineActivity[]> {
  const document = await fetchDocumentRow(documentId);
  if (!document) return [];
  const supabase = createSupabaseClient();
  return fetchTimelineForOwner(supabase, "document", document.workspace_id, documentId);
}

async function getNotesByDocumentFolderId(folderId: string): Promise<Note[]> {
  const folder = await fetchDocumentFolderRow(folderId);
  if (!folder) return [];
  const supabase = createSupabaseClient();
  return fetchNotesForOwner(supabase, "document_folder", folder.workspace_id, folderId);
}

async function createDocumentFolderNote(folderId: string, input: NoteFormInput): Promise<DataResult<Note>> {
  const folder = await fetchDocumentFolderRow(folderId);
  if (!folder) {
    return fail("Folder not found.");
  }
  return createNoteForOwner("document_folder", folder.workspace_id, folderId, input);
}

async function togglePinDocumentFolderNote(noteId: string): Promise<DataResult<Note> | null> {
  return togglePinNoteForOwner("document_folder", noteId);
}

async function getTimelineByDocumentFolderId(folderId: string): Promise<TimelineActivity[]> {
  const folder = await fetchDocumentFolderRow(folderId);
  if (!folder) return [];
  const supabase = createSupabaseClient();
  return fetchTimelineForOwner(supabase, "document_folder", folder.workspace_id, folderId);
}

export const supabaseDocumentsRepository: DocumentsRepository = {
  getDocuments,
  getDocumentById,
  createDocumentMetadata,
  updateDocumentMetadata,
  activateDocument,
  createDocumentVersion,
  archiveDocument,
  restoreDocument,
  softDeleteDocument,
  expireDocument,
  updateDocumentVisibility,
  moveDocumentToFolder,
  getDocumentVersions,
  getLatestDocumentVersion,
  getDocumentsByOwner,
  getDocumentsByCategory,
  getDocumentsByReference,
  getDocumentNextAction,
  getDocumentOwnerSummary,
  getWorkspaceDocumentSummary,
  attachDocumentToContractExhibit,
  attachDocumentToPayment,
  attachDocumentToExpense,
  attachDocumentToInvoice,
  attachDocumentToEvent,
  attachDocumentToClient,
  getDocumentFolders,
  getDocumentFolderById,
  createDocumentFolder,
  updateDocumentFolder,
  moveDocumentFolder,
  archiveDocumentFolder,
  restoreDocumentFolder,
  getDocumentFolderTree,
  getDocumentFolderPath,
  applyDefaultFolderTemplate,
  getNotesByDocumentId,
  createDocumentNote,
  togglePinDocumentNote,
  getTimelineByDocumentId,
  getNotesByDocumentFolderId,
  createDocumentFolderNote,
  togglePinDocumentFolderNote,
  getTimelineByDocumentFolderId,
};
