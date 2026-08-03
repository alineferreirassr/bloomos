import type { ComposedDocument, DocumentAnalyticsSnapshot, DocumentBundle, DocumentBundleStatus } from "@/types/documentPlatform";
import { DOCUMENT_BUNDLE_STATUSES } from "@/types/documentPlatform";

/**
 * v2 Checkpoint 44, Step 12 — Document Analytics. Pure aggregation over
 * already-fetched `ComposedDocument[]`/`DocumentBundle[]` — the same "no
 * store access, no `Date.now()`" discipline `computeProposalAnalytics`
 * (Checkpoint 33) already established.
 */

function incrementCount(map: Record<string, number>, key: string | null): void {
  if (!key) return;
  map[key] = (map[key] ?? 0) + 1;
}

export function computeDocumentAnalytics(documents: ComposedDocument[], bundles: DocumentBundle[], evaluatedAt: string): DocumentAnalyticsSnapshot {
  let draftDocumentCount = 0;
  let publishedDocumentCount = 0;
  let archivedDocumentCount = 0;
  const templateUsage: Record<string, number> = {};
  const documentTypeUsage: Record<string, number> = {};

  for (const document of documents) {
    if (document.status === "draft") draftDocumentCount += 1;
    if (document.status === "published") publishedDocumentCount += 1;
    if (document.status === "archived") archivedDocumentCount += 1;
    incrementCount(templateUsage, document.templateId);
    incrementCount(documentTypeUsage, document.documentTypeId);
  }

  const bundleStatusCounts = DOCUMENT_BUNDLE_STATUSES.reduce((acc, status) => {
    acc[status] = 0;
    return acc;
  }, {} as Record<DocumentBundleStatus, number>);
  const bundleItemKindUsage: Record<string, number> = {};
  let totalBundleItems = 0;

  for (const bundle of bundles) {
    bundleStatusCounts[bundle.status] += 1;
    totalBundleItems += bundle.items.length;
    for (const item of bundle.items) incrementCount(bundleItemKindUsage, item.kind);
  }

  return {
    totalComposedDocuments: documents.length,
    draftDocumentCount,
    publishedDocumentCount,
    archivedDocumentCount,
    templateUsage,
    documentTypeUsage,
    totalBundles: bundles.length,
    bundleStatusCounts,
    averageItemsPerBundle: bundles.length === 0 ? 0 : Math.round((totalBundleItems / bundles.length) * 10) / 10,
    bundleItemKindUsage,
    evaluatedAt,
  };
}
