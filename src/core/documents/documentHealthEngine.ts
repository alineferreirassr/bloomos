import type {
  ComposedDocument,
  ComposedDocumentHealth,
  ComposedDocumentHealthCategoryScore,
  DocumentBundle,
  DocumentBundleHealth,
  DocumentBundleHealthCategoryScore,
  DocumentPlatformHealthSummary,
  ResolvedDocumentBundleItem,
} from "@/types/documentPlatform";

/**
 * v2 Checkpoint 44, Step 12 — Document Health. Two pure scoring functions,
 * mirroring `computeContractHealth`'s own `scoreCategory`/`notApplicable`
 * pattern (Checkpoint 34) exactly — no store access, no `Date.now()`, the
 * caller injects `now`/`evaluatedAt` and every input it already fetched.
 */

function scoreComposedDocumentCategory(category: ComposedDocumentHealthCategoryScore["category"], score: number, issues: string[]): ComposedDocumentHealthCategoryScore {
  return { category, score: Math.max(0, Math.min(100, Math.round(score))), issues, notApplicableReason: null };
}

function scoreBundleCategory(category: DocumentBundleHealthCategoryScore["category"], score: number, issues: string[]): DocumentBundleHealthCategoryScore {
  return { category, score: Math.max(0, Math.min(100, Math.round(score))), issues, notApplicableReason: null };
}

function bundleNotApplicable(category: DocumentBundleHealthCategoryScore["category"], reason: string): DocumentBundleHealthCategoryScore {
  return { category, score: null, issues: [], notApplicableReason: reason };
}

function overallOf(categories: Array<{ score: number | null }>): number {
  const scored = categories.filter((c): c is { score: number } => c.score !== null);
  return scored.length === 0 ? 0 : Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length);
}

export function computeComposedDocumentHealth(document: ComposedDocument, evaluatedAt: string): ComposedDocumentHealth {
  const categories: ComposedDocumentHealthCategoryScore[] = [];

  // completeness
  const completenessChecks: Array<[boolean, string]> = [
    [document.metadata.title.trim().length > 0, "Title is missing."],
    [document.metadata.description.trim().length > 0, "Description is missing."],
    [document.content.length > 0, "The document has no content blocks."],
  ];
  const failedCompleteness = completenessChecks.filter(([ok]) => !ok);
  categories.push(scoreComposedDocumentCategory("completeness", ((completenessChecks.length - failedCompleteness.length) / completenessChecks.length) * 100, failedCompleteness.map(([, issue]) => issue)));

  // context_link
  const hasContext = document.metadata.clientName !== null || document.metadata.eventTitle !== null;
  categories.push(scoreComposedDocumentCategory("context_link", hasContext ? 100 : 0, hasContext ? [] : ["This document isn't linked to a Client or Event."]));

  // versioning
  const isPublished = document.status === "published" && document.currentVersion > 0;
  categories.push(scoreComposedDocumentCategory("versioning", isPublished ? 100 : 0, isPublished ? [] : ["This document has never been published to an immutable version."]));

  return { categories, overallScore: overallOf(categories), evaluatedAt };
}

export function computeDocumentBundleHealth(bundle: DocumentBundle, resolvedItems: ResolvedDocumentBundleItem[], evaluatedAt: string): DocumentBundleHealth {
  const categories: DocumentBundleHealthCategoryScore[] = [];

  // completeness
  const completenessChecks: Array<[boolean, string]> = [
    [bundle.title.trim().length > 0, "Title is missing."],
    [bundle.items.length > 0, "No items have been added to this bundle."],
  ];
  const failedCompleteness = completenessChecks.filter(([ok]) => !ok);
  categories.push(scoreBundleCategory("completeness", ((completenessChecks.length - failedCompleteness.length) / completenessChecks.length) * 100, failedCompleteness.map(([, issue]) => issue)));

  // items_availability
  if (resolvedItems.length === 0) {
    categories.push(bundleNotApplicable("items_availability", "No items have been added to this bundle."));
  } else {
    const unavailable = resolvedItems.filter((item) => !item.available);
    categories.push(
      scoreBundleCategory(
        "items_availability",
        ((resolvedItems.length - unavailable.length) / resolvedItems.length) * 100,
        unavailable.map((item) => `${item.title} is no longer available.`),
      ),
    );
  }

  // client_link
  categories.push(scoreBundleCategory("client_link", bundle.clientId ? 100 : 0, bundle.clientId ? [] : ["No linked client record."]));

  // send_readiness
  const isReady = bundle.status === "ready" || bundle.status === "sent" || bundle.status === "viewed";
  categories.push(scoreBundleCategory("send_readiness", isReady ? 100 : 0, isReady ? [] : ["This bundle is still a draft."]));

  return { categories, overallScore: overallOf(categories), evaluatedAt };
}

/**
 * v2 Checkpoint 44, Step 13 — Business Health integration. Averages every
 * already-computed `ComposedDocumentHealth`/`DocumentBundleHealth` into the
 * single `{overallScore, issues}` shape `computeBusinessHealth`'s own
 * `documentPlatformHealth` optional input expects — the same
 * "supply an already-computed report, recompute nothing" contract
 * `workflowHealth`/`searchHealth`/`notificationHealth` already established.
 */
export function summarizeDocumentPlatformHealth(documentHealths: ComposedDocumentHealth[], bundleHealths: DocumentBundleHealth[]): DocumentPlatformHealthSummary {
  const allCategories = [...documentHealths.flatMap((h) => h.categories), ...bundleHealths.flatMap((h) => h.categories)];
  const scored = allCategories.filter((c): c is typeof c & { score: number } => c.score !== null);
  const issues = allCategories.flatMap((c) => c.issues);

  if (scored.length === 0) return { overallScore: null, issues: [] };
  return { overallScore: Math.round(scored.reduce((sum, c) => sum + c.score, 0) / scored.length), issues };
}
