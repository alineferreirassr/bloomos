import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { RouteFinding, RouteFindingSeverity, RoutePlan } from "@/types/routeOptimization";

/**
 * v2.0 Checkpoint 30, Step 10 — Executive Integration's translation
 * half. Translates `RouteFinding[]` into the Executive Decision
 * Platform's existing `OperationalRecommendation` shape — the same
 * "translate, don't duplicate" discipline `fieldOperationFindingsEngine.ts`/
 * `dispatchFindingsEngine.ts` established. This file detects nothing;
 * every recommendation traces back to a finding `routeRiskEngine.ts`
 * already computed. Reaching Operational Intelligence/Business Health
 * (the spec's other two named feed targets) happens transitively
 * through Executive Decisions — the same scope every prior checkpoint's
 * own Executive Integration disclosed.
 */
const SEVERITY_MAP: Record<RouteFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

function resolveFindingNode(finding: RouteFinding, planById: Map<string, RoutePlan>, workspaceId: string): KnowledgeNodeRef {
  if (finding.relatedRoutePlanId !== null) {
    const plan = planById.get(finding.relatedRoutePlanId);
    if (plan?.context) return plan.context;
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function routeFindingsToRecommendations(findings: RouteFinding[], routePlans: RoutePlan[], workspaceId: string): OperationalRecommendation[] {
  const planById = new Map(routePlans.map((p) => [p.id, p] as const));
  return findings.map((finding) => ({
    ruleId: `route_optimization.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, planById, workspaceId),
  }));
}
