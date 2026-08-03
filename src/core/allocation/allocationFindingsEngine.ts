import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { AllocationFinding, AllocationFindingSeverity, AllocationRequest, Allocation } from "@/types/allocation";

/**
 * v2.0 Checkpoint 27.1, Step 18 — Executive Integration's translation
 * half. Translates `AllocationFinding[]` into the Executive Decision
 * Platform's existing `OperationalRecommendation` shape — the same
 * "translate, don't duplicate" discipline `capabilityFindingsEngine.ts`/
 * `schedulingFindingsEngine.ts` established. This file detects nothing;
 * every recommendation traces back to a finding `allocationRiskEngine.ts`
 * already computed.
 */
const SEVERITY_MAP: Record<AllocationFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

/** Prefers the related request's own context node (directly, or via the related allocation's `request_id`), and finally falls back to the workspace itself — never a fabricated node. */
function resolveFindingNode(finding: AllocationFinding, requestById: Map<string, AllocationRequest>, allocationById: Map<string, Allocation>, workspaceId: string): KnowledgeNodeRef {
  const requestId = finding.relatedRequestId ?? (finding.relatedAllocationId !== null ? (allocationById.get(finding.relatedAllocationId)?.request_id ?? null) : null);
  if (requestId !== null) {
    const request = requestById.get(requestId);
    if (request?.context) return request.context;
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function allocationFindingsToRecommendations(findings: AllocationFinding[], requests: AllocationRequest[], allocations: Allocation[], workspaceId: string): OperationalRecommendation[] {
  const requestById = new Map(requests.map((r) => [r.id, r] as const));
  const allocationById = new Map(allocations.map((a) => [a.id, a] as const));
  return findings.map((finding) => ({
    ruleId: `allocation.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, requestById, allocationById, workspaceId),
  }));
}
