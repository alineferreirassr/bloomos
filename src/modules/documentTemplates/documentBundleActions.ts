"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { resolveBundleItems } from "@/core/documents/bundleResolver";
import { computeDocumentBundleHealth } from "@/core/documents/documentHealthEngine";
import type { CreateDocumentBundleInput } from "@/lib/data/core/documents/repository";
import type { DocumentBundle, DocumentBundleHealth, DocumentBundleItemKind, DocumentBundleStatus, ResolvedDocumentBundleItem } from "@/types/documentPlatform";

const GENERIC_ACCESS_ERROR = "Document Bundles aren't available right now.";
const NOT_FOUND_ERROR = "That document bundle could not be found.";

export type DocumentBundleActionResult = { success: true; data: DocumentBundle } | { success: false; error: string };

export interface DocumentBundleDetail {
  bundle: DocumentBundle;
  resolvedItems: ResolvedDocumentBundleItem[];
  health: DocumentBundleHealth;
}
export type GetDocumentBundleDetailResult = { success: true; data: DocumentBundleDetail } | { success: false; error: string };

/**
 * v2 Checkpoint 44, Step 14 — the module actions layer Document Bundles
 * (Step 5) never got. Every function here is a thin, session-gated wrapper
 * around the real `DocumentsManager` (Checkpoint 12) — no new bundle logic,
 * matching the exact `session -> workspace-ownership guard -> manager call`
 * shape `contractPlatformActions.ts` already established.
 */
export async function createDocumentBundleAction(input: CreateDocumentBundleInput): Promise<DocumentBundleActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("documents.create")) return { success: false, error: GENERIC_ACCESS_ERROR };

  return getDocumentsManager().createDocumentBundle(session.workspace.id, session.membership.id, input);
}

export async function listDocumentBundlesForClientAction(clientId: string): Promise<{ success: true; data: DocumentBundle[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  return { success: true, data: await getDocumentsManager().listDocumentBundlesForClient(session.workspace.id, clientId) };
}

export async function getDocumentBundleDetailAction(bundleId: string): Promise<GetDocumentBundleDetailResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getDocumentsManager();
  const bundle = await manager.getDocumentBundleById(bundleId);
  if (!bundle || bundle.workspaceId !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  const resolvedItems = await resolveBundleItems(bundle.items);
  const health = computeDocumentBundleHealth(bundle, resolvedItems, new Date().toISOString());
  return { success: true, data: { bundle, resolvedItems, health } };
}

async function loadOwnedBundle(bundleId: string, workspaceId: string): Promise<DocumentBundle | null> {
  const bundle = await getDocumentsManager().getDocumentBundleById(bundleId);
  if (!bundle || bundle.workspaceId !== workspaceId) return null;
  return bundle;
}

export async function addDocumentBundleItemAction(bundleId: string, kind: DocumentBundleItemKind, refId: string): Promise<DocumentBundleActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("documents.update")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await loadOwnedBundle(bundleId, session.workspace.id))) return { success: false, error: NOT_FOUND_ERROR };

  return getDocumentsManager().addDocumentBundleItem(bundleId, kind, refId);
}

export async function removeDocumentBundleItemAction(bundleId: string, itemId: string): Promise<DocumentBundleActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("documents.update")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await loadOwnedBundle(bundleId, session.workspace.id))) return { success: false, error: NOT_FOUND_ERROR };

  return getDocumentsManager().removeDocumentBundleItem(bundleId, itemId);
}

export async function updateDocumentBundleStatusAction(bundleId: string, status: DocumentBundleStatus): Promise<DocumentBundleActionResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("documents.update")) return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!(await loadOwnedBundle(bundleId, session.workspace.id))) return { success: false, error: NOT_FOUND_ERROR };

  return getDocumentsManager().updateDocumentBundleStatus(bundleId, status);
}
