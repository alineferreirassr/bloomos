import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { OperationalFinding, OperationalFindingSeverity, OperationalPlan } from "@/types/operationalPlanning";

/**
 * v2.0 Checkpoint 27.2, Step 18 — Executive Integration's translation
 * half. Translates `OperationalFinding[]` into the Executive Decision
 * Platform's existing `OperationalRecommendation` shape — the same
 * "translate, don't duplicate" discipline `allocationFindingsEngine.ts`/
 * `schedulingFindingsEngine.ts`/`capabilityFindingsEngine.ts`
 * established. This file detects nothing; every recommendation traces
 * back to a finding `operationalRiskEngine.ts` already computed.
 */
const SEVERITY_MAP: Record<OperationalFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

/** Prefers the related plan's own context node, and finally falls back to the workspace itself — never a fabricated node. */
function resolveFindingNode(finding: OperationalFinding, planById: Map<string, OperationalPlan>, workspaceId: string): KnowledgeNodeRef {
  if (finding.relatedPlanId !== null) {
    const plan = planById.get(finding.relatedPlanId);
    if (plan?.context) return plan.context;
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function operationalFindingsToRecommendations(findings: OperationalFinding[], plans: OperationalPlan[], workspaceId: string): OperationalRecommendation[] {
  const planById = new Map(plans.map((p) => [p.id, p] as const));
  return findings.map((finding) => ({
    ruleId: `operational_planning.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, planById, workspaceId),
  }));
}
