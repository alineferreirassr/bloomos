import type { RecommendationSource } from "@/core/executiveDecisions/executiveDecisionEngine";
import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { NotificationHealthReport } from "@/types/notificationHealth";

/**
 * v2.0 Checkpoint 41, Step 10 — Executive Decisions integration. Translates
 * `NotificationHealthReport` (`notificationHealthEngine.ts`) into the exact
 * `OperationalRecommendation` shape every other platform already feeds
 * `executiveDecisionEngine.ts` with — mirrors `core/search/executiveIntegration.ts`
 * (Checkpoint 40) precisely. Every recommendation uses `nodeType: "workspace"`
 * since Notification Health is workspace-wide, never per-record, the same
 * precedent `search_health`/`workflow_readiness` already established.
 */
function severityForCategory(score: number | null): RecommendationSeverity {
  if (score === null) return "info";
  if (score < 50) return "critical";
  if (score < 80) return "warning";
  return "info";
}

export function notificationHealthToRecommendations(report: NotificationHealthReport, workspaceId: string): OperationalRecommendation[] {
  const node = { nodeType: "workspace" as const, nodeId: workspaceId };
  const recommendations: OperationalRecommendation[] = [];

  for (const category of report.categories) {
    for (const issue of category.issues) {
      recommendations.push({ ruleId: `notification_health_${category.category}`, message: issue, severity: severityForCategory(category.score), node });
    }
  }

  return recommendations;
}

/** A ready-to-append `RecommendationSource` for `generateDecisionDrafts()`'s own `recommendationSources` array. */
export function notificationHealthRecommendationSource(report: NotificationHealthReport, workspaceId: string): RecommendationSource {
  return { generatedBy: "notification_health_engine", recommendations: notificationHealthToRecommendations(report, workspaceId) };
}
