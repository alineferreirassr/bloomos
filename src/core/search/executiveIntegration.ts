import type { RecommendationSource } from "@/core/executiveDecisions/executiveDecisionEngine";
import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { SearchHealthReport } from "@/types/searchHealth";

/**
 * v2.0 Checkpoint 40 — Global Search & Universal Command Center. Translates
 * `SearchHealthReport` (`searchHealthEngine.ts`) into the exact
 * `OperationalRecommendation` shape every other platform already feeds
 * `executiveDecisionEngine.ts` with — no new recommendation model, no
 * duplicated scoring. Mirrors `core/workflowMonitoring/executiveIntegration.ts`'s
 * own structure precisely. Every recommendation uses `nodeType: "workspace"`
 * — Search Health is workspace-wide, never per-entity, the same precedent
 * `core/digitalAssets/executiveIntegration.ts` and
 * `core/scheduling/schedulingFindingsEngine.ts` already established for a
 * platform-wide (not per-record) finding.
 */
function severityForCategory(score: number | null): RecommendationSeverity {
  if (score === null) return "info";
  if (score < 50) return "critical";
  if (score < 80) return "warning";
  return "info";
}

export function searchHealthToRecommendations(report: SearchHealthReport, workspaceId: string): OperationalRecommendation[] {
  const node = { nodeType: "workspace" as const, nodeId: workspaceId };
  const recommendations: OperationalRecommendation[] = [];

  for (const category of report.categories) {
    for (const issue of category.issues) {
      recommendations.push({ ruleId: `search_health_${category.category}`, message: issue, severity: severityForCategory(category.score), node });
    }
  }

  return recommendations;
}

/** A ready-to-append `RecommendationSource` for `generateDecisionDrafts()`'s own `recommendationSources` array. */
export function searchHealthRecommendationSource(report: SearchHealthReport, workspaceId: string): RecommendationSource {
  return { generatedBy: "search_health_engine", recommendations: searchHealthToRecommendations(report, workspaceId) };
}
