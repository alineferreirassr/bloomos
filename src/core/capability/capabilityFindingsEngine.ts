import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { WorkforceRisk, CapabilityRequirement, WorkforceRiskSeverity } from "@/types/capability";

/**
 * v2.0 Checkpoint 26.1, Step 18 — Operational Intelligence Integration.
 * Translates `WorkforceRisk[]` (Step 20) into the Executive Decision
 * Platform's own `OperationalRecommendation` shape (Step 15.5) — the
 * same "translate, don't duplicate" discipline
 * `operationalRecommendationEngine.ts` established for Business Rule
 * Violations. This file detects nothing; every recommendation traces
 * back to a risk `capabilityRiskEngine.ts` already computed.
 */
const SEVERITY_MAP: Record<WorkforceRiskSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

/** Prefers the most specific real node available on the risk (worker, then equipment, then vehicle), falls back to the related requirement's own context node, and finally to the workspace itself — never a fabricated node. */
function resolveRiskNode(risk: WorkforceRisk, requirementById: Map<string, CapabilityRequirement>, workspaceId: string): KnowledgeNodeRef {
  if (risk.relatedWorkerId) return { nodeType: "worker", nodeId: risk.relatedWorkerId };
  if (risk.relatedEquipmentId) return { nodeType: "equipment", nodeId: risk.relatedEquipmentId };
  if (risk.relatedVehicleId) return { nodeType: "vehicle", nodeId: risk.relatedVehicleId };
  const requirement = risk.relatedRequirementId ? requirementById.get(risk.relatedRequirementId) : null;
  if (requirement?.context) return requirement.context;
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function capabilityRisksToRecommendations(risks: WorkforceRisk[], requirements: CapabilityRequirement[], workspaceId: string): OperationalRecommendation[] {
  const requirementById = new Map(requirements.map((r) => [r.id, r] as const));
  return risks.map((risk) => ({
    ruleId: `workforce_capability.${risk.type}`,
    message: risk.description,
    severity: SEVERITY_MAP[risk.severity],
    node: resolveRiskNode(risk, requirementById, workspaceId),
  }));
}
