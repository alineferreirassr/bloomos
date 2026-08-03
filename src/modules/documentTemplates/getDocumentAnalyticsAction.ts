"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getDocumentsManager } from "@/core/documents/manager";
import { computeDocumentAnalytics } from "@/core/documents/documentAnalyticsEngine";
import type { DocumentAnalyticsSnapshot } from "@/types/documentPlatform";

const GENERIC_ACCESS_ERROR = "Document Analytics isn't available right now.";

export type GetDocumentAnalyticsResult = { success: true; data: DocumentAnalyticsSnapshot } | { success: false; error: string };

/**
 * v2 Checkpoint 44, Step 12 — reads every Composed Document and Document
 * Bundle for the Workspace through the existing `DocumentsManager`
 * (Checkpoint 12 / Step 5) and aggregates them through the pure
 * `documentAnalyticsEngine.ts` — never a second read path, never a cached
 * snapshot.
 */
export async function getDocumentAnalyticsAction(): Promise<GetDocumentAnalyticsResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  const manager = getDocumentsManager();
  const [documents, bundles] = await Promise.all([manager.listComposedDocuments(session.workspace.id), manager.listDocumentBundlesForWorkspace(session.workspace.id)]);

  return { success: true, data: computeDocumentAnalytics(documents, bundles, new Date().toISOString()) };
}
