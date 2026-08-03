"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { resolveBundleItems } from "@/core/documents/bundleResolver";
import { computeComposedDocumentHealth, computeDocumentBundleHealth, summarizeDocumentPlatformHealth } from "@/core/documents/documentHealthEngine";
import { documentPlatformRecommendationsForExecutiveDecisions } from "@/core/documents/executiveIntegration";
import type { ComposedDocumentHealth, DocumentBundleHealth, DocumentPlatformHealthSummary } from "@/types/documentPlatform";
import type { OperationalRecommendation } from "@/types/businessHealth";

const GENERIC_ACCESS_ERROR = "Document Health isn't available right now.";
const NOT_FOUND_ERROR = "That document could not be found.";
const BUNDLE_NOT_FOUND_ERROR = "That document bundle could not be found.";

export type GetComposedDocumentHealthResult = { success: true; data: ComposedDocumentHealth } | { success: false; error: string };
export type GetDocumentBundleHealthResult = { success: true; data: DocumentBundleHealth } | { success: false; error: string };

/**
 * v2 Checkpoint 44, Step 12 — reads a real `ComposedDocument`/`DocumentBundle`
 * through the existing `DocumentsManager` (Checkpoint 12) and scores it
 * through the pure `documentHealthEngine.ts` — never a second read path,
 * never a cached/persisted score.
 */
export async function getComposedDocumentHealthAction(documentId: string): Promise<GetComposedDocumentHealthResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getDocumentsManager();
  const document = await manager.getComposedDocumentById(documentId);
  if (!document || document.workspaceId !== session.workspace.id) return { success: false, error: NOT_FOUND_ERROR };

  return { success: true, data: computeComposedDocumentHealth(document, new Date().toISOString()) };
}

export async function getDocumentBundleHealthAction(bundleId: string): Promise<GetDocumentBundleHealthResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getDocumentsManager();
  const bundle = await manager.getDocumentBundleById(bundleId);
  if (!bundle || bundle.workspaceId !== session.workspace.id) return { success: false, error: BUNDLE_NOT_FOUND_ERROR };

  const resolvedItems = await resolveBundleItems(bundle.items);
  return { success: true, data: computeDocumentBundleHealth(bundle, resolvedItems, new Date().toISOString()) };
}

// ---------------------------------------------------------------------------
// Business Health + Executive Decisions (Step 13) — zero-arg seams, empty
// result on no session, the same "one more optional input, one more
// `recommendationSources` entry" contract every prior platform's own
// `computeBusinessHealth`/`recommendationSources` wiring already established.
// ---------------------------------------------------------------------------

/** Reads every Document + Bundle for the Workspace and scores them, for `computeBusinessHealth`'s own `documentPlatformHealth` optional input. */
export async function getDocumentPlatformHealthForBusinessHealth(): Promise<DocumentPlatformHealthSummary | null> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return null;

  const manager = getDocumentsManager();
  const [documents, bundles] = await Promise.all([manager.listComposedDocuments(session.workspace.id), manager.listDocumentBundlesForWorkspace(session.workspace.id)]);

  const documentHealths = documents.map((document) => computeComposedDocumentHealth(document, new Date().toISOString()));
  const bundleHealths = await Promise.all(
    bundles.map(async (bundle) => computeDocumentBundleHealth(bundle, await resolveBundleItems(bundle.items), new Date().toISOString())),
  );

  return summarizeDocumentPlatformHealth(documentHealths, bundleHealths);
}

export async function documentPlatformRecommendationsForExecutiveDecisionsAction(): Promise<OperationalRecommendation[]> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return [];

  const manager = getDocumentsManager();
  const [documents, bundles] = await Promise.all([manager.listComposedDocuments(session.workspace.id), manager.listDocumentBundlesForWorkspace(session.workspace.id)]);

  const documentHealths = documents.map((document) => computeComposedDocumentHealth(document, new Date().toISOString()));
  const bundleInputs = await Promise.all(
    bundles.map(async (bundle) => ({ bundle, health: computeDocumentBundleHealth(bundle, await resolveBundleItems(bundle.items), new Date().toISOString()) })),
  );

  return documentPlatformRecommendationsForExecutiveDecisions(bundleInputs, documentHealths);
}
