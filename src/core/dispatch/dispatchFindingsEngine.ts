import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { DispatchFinding, DispatchFindingSeverity, DispatchOrder } from "@/types/dispatch";

/**
 * v2.0 Checkpoint 28, Step 11 — Executive Integration's translation
 * half. Translates `DispatchFinding[]` into the Executive Decision
 * Platform's existing `OperationalRecommendation` shape — the same
 * "translate, don't duplicate" discipline `executionPackageFindingsEngine.ts`/
 * `allocationFindingsEngine.ts`/`schedulingFindingsEngine.ts`/
 * `capabilityFindingsEngine.ts` established. This file detects nothing;
 * every recommendation traces back to a finding `dispatchRiskEngine.ts`
 * already computed. Reaching Business Health/Operational Intelligence
 * (the spec's other two named feed targets) happens transitively through
 * Executive Decisions — the same "feed Executive Decisions only,
 * directly" scope every prior checkpoint's Executive Integration
 * disclosed before it.
 */
const SEVERITY_MAP: Record<DispatchFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

function resolveFindingNode(finding: DispatchFinding, orderById: Map<string, DispatchOrder>, workspaceId: string): KnowledgeNodeRef {
  if (finding.relatedOrderId !== null) {
    const order = orderById.get(finding.relatedOrderId);
    if (order !== undefined) return { nodeType: "workspace", nodeId: order.workspace_id };
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function dispatchFindingsToRecommendations(findings: DispatchFinding[], orders: DispatchOrder[], workspaceId: string): OperationalRecommendation[] {
  const orderById = new Map(orders.map((o) => [o.id, o] as const));
  return findings.map((finding) => ({
    ruleId: `dispatch.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, orderById, workspaceId),
  }));
}
