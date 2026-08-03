import type { OperationalRecommendation } from "@/types/businessHealth";
import type { ComposedDocumentHealth, DocumentBundle, DocumentBundleHealth } from "@/types/documentPlatform";

export interface DocumentBundleHealthInput {
  bundle: DocumentBundle;
  health: DocumentBundleHealth;
}

/**
 * v2 Checkpoint 44, Step 13 — Executive Decisions integration. Translates
 * already-computed `ComposedDocumentHealth`/`DocumentBundleHealth` results
 * (Step 12's `documentHealthEngine.ts`) into `OperationalRecommendation`s —
 * the same "one more `recommendationSources` entry, never a second decision
 * engine" precedent `digitalAssetsRecommendationsForExecutiveDecisions`
 * (Checkpoint 37) already established. Every recommendation traces back to
 * a real Health category's own issue, not a guess. Takes paired
 * `{bundle, health}` inputs — the same "caller pairs its own already-fetched
 * records" contract `ProposalAnalyticsInput` (Checkpoint 33) established —
 * rather than two parallel arrays a callee would have to (mis)match itself.
 */
export function documentPlatformRecommendationsForExecutiveDecisions(bundleInputs: DocumentBundleHealthInput[], documentHealths: ComposedDocumentHealth[]): OperationalRecommendation[] {
  const recommendations: OperationalRecommendation[] = [];

  for (const { bundle, health } of bundleInputs) {
    const itemsAvailability = health.categories.find((c) => c.category === "items_availability");
    if (itemsAvailability && itemsAvailability.score !== null && itemsAvailability.score < 100) {
      recommendations.push({
        ruleId: "document_bundle_unavailable_items",
        message: `"${bundle.title}" references an item that's no longer available.`,
        severity: "warning",
        node: { nodeType: "document_bundle", nodeId: bundle.id },
      });
    }

    const sendReadiness = health.categories.find((c) => c.category === "send_readiness");
    if (sendReadiness && sendReadiness.score === 0 && bundle.items.length > 0) {
      recommendations.push({
        ruleId: "document_bundle_stuck_in_draft",
        message: `"${bundle.title}" has items but is still a draft — send it or mark it ready.`,
        severity: "info",
        node: { nodeType: "document_bundle", nodeId: bundle.id },
      });
    }
  }

  const unpublishedCount = documentHealths.filter((h) => {
    const versioning = h.categories.find((c) => c.category === "versioning");
    return versioning && versioning.score === 0;
  }).length;
  if (unpublishedCount >= 5) {
    recommendations.push({
      ruleId: "document_platform_many_unpublished_documents",
      message: `${unpublishedCount} generated documents have never been published to an immutable version.`,
      severity: "info",
      node: { nodeType: "workspace", nodeId: "workspace" },
    });
  }

  return recommendations;
}
