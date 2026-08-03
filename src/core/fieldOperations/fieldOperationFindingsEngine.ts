import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { FieldOperationFinding, FieldOperationFindingSeverity, FieldOperation } from "@/types/fieldOperations";

/**
 * v2.0 Checkpoint 29, Step 11 — Executive Integration's translation
 * half. Translates `FieldOperationFinding[]` into the Executive Decision
 * Platform's existing `OperationalRecommendation` shape — the same
 * "translate, don't duplicate" discipline `dispatchFindingsEngine.ts`/
 * `executionPackageFindingsEngine.ts` established. This file detects
 * nothing; every recommendation traces back to a finding
 * `fieldOperationRiskEngine.ts` already computed. Reaching Business
 * Health/Operational Intelligence (the spec's other two named feed
 * targets) happens transitively through Executive Decisions — the same
 * scope every prior checkpoint's own Executive Integration disclosed.
 */
const SEVERITY_MAP: Record<FieldOperationFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

function resolveFindingNode(finding: FieldOperationFinding, operationById: Map<string, FieldOperation>, workspaceId: string): KnowledgeNodeRef {
  if (finding.relatedFieldOperationId !== null) {
    const operation = operationById.get(finding.relatedFieldOperationId);
    if (operation?.context) return operation.context;
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function fieldOperationFindingsToRecommendations(findings: FieldOperationFinding[], operations: FieldOperation[], workspaceId: string): OperationalRecommendation[] {
  const operationById = new Map(operations.map((o) => [o.id, o] as const));
  return findings.map((finding) => ({
    ruleId: `field_operations.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, operationById, workspaceId),
  }));
}
