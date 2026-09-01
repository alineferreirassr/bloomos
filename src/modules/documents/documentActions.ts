"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import {
  getDocumentById,
  getDocumentFolderById,
  activateDocument as repoActivateDocument,
  archiveDocument as repoArchiveDocument,
  restoreDocument as repoRestoreDocument,
  softDeleteDocument as repoSoftDeleteDocument,
  expireDocument as repoExpireDocument,
  updateDocumentVisibility as repoUpdateDocumentVisibility,
  moveDocumentToFolder as repoMoveDocumentToFolder,
  createDocumentVersion as repoCreateDocumentVersion,
  archiveDocumentFolder as repoArchiveDocumentFolder,
  restoreDocumentFolder as repoRestoreDocumentFolder,
  createDocumentFolder as repoCreateDocumentFolder,
  updateDocumentFolder as repoUpdateDocumentFolder,
  moveDocumentFolder as repoMoveDocumentFolder,
  applyDefaultFolderTemplate as repoApplyDefaultFolderTemplate,
  createDocumentMetadata as repoCreateDocumentMetadata,
  updateDocumentMetadata as repoUpdateDocumentMetadata,
} from "@/lib/data";
import { fail, type DataResult } from "@/lib/data/result";
import type { Document } from "@/types/document";
import type { DocumentFolder } from "@/types/documentFolder";
import type { DocumentVisibility } from "@/core/enums/documentVisibility";
import type { NewDocumentVersionInput } from "@/modules/documents/schema";
import type { Permission } from "@/core/enums/permission";
import type { DocumentFolderInput, DocumentMetadataInput } from "@/modules/documents/schema";
import type { DocumentMetadataUpdateInput } from "@/lib/data/documents/repository";
import type { EntityType } from "@/core/enums/entityType";
import type { FolderTemplateKind } from "@/modules/documents/constants/folderTemplates";

const NOT_SIGNED_IN = "You must be signed in.";
const NOT_FOUND = "Document not found.";
const FOLDER_NOT_FOUND = "Folder not found.";

/**
 * Every base Document/DocumentFolder mutation used to be a bare passthrough
 * to the repository — callable directly from any `"use client"` component
 * with zero permission check, unlike `documentTemplates`'s lifecycle
 * actions. These wrappers give the base Documents module the same
 * server-side gate: active membership, the specific permission the
 * client-side `can()` checks already implied (`documents.update` for
 * ordinary edits, `documents.archive` for the terminal/destructive
 * transitions), and workspace ownership — so a caller can no longer mutate
 * a Document merely by importing the repository function directly, bypassing
 * whatever buttons a route happens to render.
 */
async function requireDocumentPermission(
  documentId: string,
  permission: Permission,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: NOT_SIGNED_IN };
  if (!session.permissions.includes(permission)) return { success: false, error: "You don't have permission to manage Documents." };
  try {
    const document = await getDocumentById(documentId);
    if (document.workspace_id !== session.workspace.id) return { success: false, error: NOT_FOUND };
  } catch {
    return { success: false, error: NOT_FOUND };
  }
  return { success: true };
}

/**
 * For mutations that create a new record — there's no existing entity yet
 * to check workspace ownership against, so this only verifies an active
 * session and the required permission. The repository itself derives the
 * target workspace from the authenticated session (never from client
 * input), so this is not a cross-workspace gap — see `createDocumentFolder`/
 * `applyDefaultFolderTemplate` in the Supabase repository, both of which
 * call `requireWorkspaceSession()` internally.
 */
async function requireCreatePermission(
  permission: Permission,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: NOT_SIGNED_IN };
  if (!session.permissions.includes(permission)) return { success: false, error: "You don't have permission to manage Documents." };
  return { success: true };
}

async function requireFolderPermission(
  folderId: string,
  permission: Permission,
): Promise<{ success: true } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: NOT_SIGNED_IN };
  if (!session.permissions.includes(permission)) return { success: false, error: "You don't have permission to manage Documents." };
  try {
    const folder = await getDocumentFolderById(folderId);
    if (folder.workspace_id !== session.workspace.id) return { success: false, error: FOLDER_NOT_FOUND };
  } catch {
    return { success: false, error: FOLDER_NOT_FOUND };
  }
  return { success: true };
}

export async function activateDocumentAction(id: string): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.update");
  if (!gate.success) return gate;
  return repoActivateDocument(id);
}

export async function restoreDocumentAction(id: string): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.archive");
  if (!gate.success) return gate;
  return repoRestoreDocument(id);
}

export async function expireDocumentAction(id: string): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.archive");
  if (!gate.success) return gate;
  return repoExpireDocument(id);
}

export async function archiveDocumentAction(id: string): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.archive");
  if (!gate.success) return gate;
  return repoArchiveDocument(id);
}

export async function softDeleteDocumentAction(id: string): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.archive");
  if (!gate.success) return gate;
  return repoSoftDeleteDocument(id);
}

export async function updateDocumentVisibilityAction(id: string, visibility: DocumentVisibility): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.update");
  if (!gate.success) return gate;
  return repoUpdateDocumentVisibility(id, visibility);
}

export async function moveDocumentToFolderAction(id: string, folderId: string | null): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.update");
  if (!gate.success) return gate;
  return repoMoveDocumentToFolder(id, folderId);
}

/**
 * Phase 06C — realigned from `documents.update` to `documents.create`, the
 * canonical permission for "add a new Version" across the Documents domain:
 * it matches the pre-existing client-side `canCreate` gate on the "Add New
 * Version" button (NewVersionModal.tsx via DocumentActions.tsx) and mirrors
 * `documentLifecycleActions.ts`'s `publishDocumentVersionAction` — the
 * sibling Document-Compiler module's own "publish a new Version" action —
 * which uses the same `documents.create` gate. The server-side permission
 * is authoritative; this was the one that needed to move, not the UI.
 */
export async function createDocumentVersionAction(input: NewDocumentVersionInput): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(input.document_id, "documents.create");
  if (!gate.success) return gate;
  return repoCreateDocumentVersion(input);
}

export async function archiveDocumentFolderAction(id: string): Promise<DataResult<DocumentFolder>> {
  const gate = await requireFolderPermission(id, "documents.archive");
  if (!gate.success) return gate;
  return repoArchiveDocumentFolder(id);
}

export async function restoreDocumentFolderAction(id: string): Promise<DataResult<DocumentFolder>> {
  const gate = await requireFolderPermission(id, "documents.archive");
  if (!gate.success) return gate;
  return repoRestoreDocumentFolder(id);
}

/**
 * Phase 06C — `createDocumentFolder`/`updateDocumentFolder` were the two
 * confirmed gaps from the Phase 06B audit; `moveDocumentFolder` and
 * `applyDefaultFolderTemplate` are the same bug class (client component →
 * unprotected folder-mutation repository call), found during this phase's
 * mandated final sweep and closed alongside them — see the Phase 06C report.
 */
export async function createDocumentFolderAction(input: DocumentFolderInput): Promise<DataResult<DocumentFolder>> {
  const gate = await requireCreatePermission("documents.create");
  if (!gate.success) return gate;
  return repoCreateDocumentFolder(input);
}

export async function updateDocumentFolderAction(
  id: string,
  input: { name: string; description: string | null; sort_order: number; visibility: DocumentVisibility },
): Promise<DataResult<DocumentFolder>> {
  const gate = await requireFolderPermission(id, "documents.update");
  if (!gate.success) return gate;
  return repoUpdateDocumentFolder(id, input);
}

export async function moveDocumentFolderAction(id: string, newParentFolderId: string | null): Promise<DataResult<DocumentFolder>> {
  const gate = await requireFolderPermission(id, "documents.update");
  if (!gate.success) return gate;
  return repoMoveDocumentFolder(id, newParentFolderId);
}

export async function applyDefaultFolderTemplateAction(input: {
  ownerType: EntityType;
  ownerId: string;
  templateKind: FolderTemplateKind;
  parentFolderId?: string | null;
}): Promise<DataResult<DocumentFolder[]>> {
  if (input.parentFolderId) {
    const gate = await requireFolderPermission(input.parentFolderId, "documents.create");
    if (!gate.success) return gate;
  } else {
    const gate = await requireCreatePermission("documents.create");
    if (!gate.success) return gate;
  }
  return repoApplyDefaultFolderTemplate(input);
}

/**
 * Phase 06D — the last two confirmed gaps from the Phase 06C final sweep:
 * `createDocumentMetadata`/`updateDocumentMetadata` (the base Document
 * *record* itself — title/description/category/visibility/owner — as
 * opposed to the folder/version/lifecycle actions already closed in 06B/06C)
 * had zero server-side permission check. Gated on `documents.create`/
 * `documents.update` — the same permissions every other Document mutation
 * in this file already uses, no new permission invented.
 *
 * `DocumentMetadataInput` (create) carries no `workspace_id` field at all —
 * the repository always derives the target workspace from the
 * authenticated session, never from client input (confirmed in both
 * `mockRepository.ts` and `supabaseRepository.ts`), so there's no
 * "workspace spoofing" field to defend against structurally. When a
 * `folder_id` is supplied, its workspace membership is checked here
 * (defense-in-depth on top of the repository's own owner/folder-match
 * validation, `validateDocumentOwnerAndReferences`, which this does not
 * duplicate — that function checks the folder belongs to the same
 * owner_type/owner_id, not workspace membership directly).
 *
 * `DocumentMetadataUpdateInput` (update) has no `folder_id`/parent field
 * at all — folder reassignment is a dedicated, already-protected action
 * (`moveDocumentToFolderAction`) — so no destination-parent check applies
 * here; workspace isolation is enforced the same way every other
 * `requireDocumentPermission` call in this file already does, against the
 * existing Document being edited.
 */
export async function createDocumentMetadataAction(input: DocumentMetadataInput): Promise<DataResult<Document>> {
  const gate = await requireCreatePermission("documents.create");
  if (!gate.success) return gate;
  if (input.folder_id) {
    const folderGate = await requireFolderPermission(input.folder_id, "documents.create");
    if (!folderGate.success) return fail("Please fix the highlighted fields.", { folder_id: "Folder not found." });
  }
  return repoCreateDocumentMetadata(input);
}

export async function updateDocumentMetadataAction(
  id: string,
  input: DocumentMetadataUpdateInput,
): Promise<DataResult<Document>> {
  const gate = await requireDocumentPermission(id, "documents.update");
  if (!gate.success) return gate;
  return repoUpdateDocumentMetadata(id, input);
}
