import type { OperationalRecommendation, RecommendationSeverity } from "@/types/businessHealth";
import type { KnowledgeNodeRef } from "@/types/knowledgeGraph";
import type { PackageFinding, PackageFindingSeverity, ExecutionPackage } from "@/types/executionPackage";

/**
 * v2.0 Checkpoint 27.3, Step 13 — Executive Integration's translation
 * half. Translates `PackageFinding[]` into the Executive Decision
 * Platform's existing `OperationalRecommendation` shape — the same
 * "translate, don't duplicate" discipline `operationalFindingsEngine.ts`/
 * `allocationFindingsEngine.ts`/`schedulingFindingsEngine.ts`/
 * `capabilityFindingsEngine.ts` established. This file detects nothing;
 * every recommendation traces back to a finding
 * `executionPackageRiskEngine.ts` already computed. Reaching Business
 * Health/Operational Intelligence (the spec's other two named feed
 * targets) happens transitively through Executive Decisions — the same
 * "feed Executive Decisions only, directly" scope Scheduling/Allocation/
 * Operational Planning's own Executive Integration disclosed before it;
 * none of those checkpoints touched `core/knowledge/businessHealthEngine.ts`'s
 * own input signature either.
 */
const SEVERITY_MAP: Record<PackageFindingSeverity, RecommendationSeverity> = {
  high: "critical",
  medium: "warning",
  low: "info",
};

function resolveFindingNode(finding: PackageFinding, packageById: Map<string, ExecutionPackage>, workspaceId: string): KnowledgeNodeRef {
  if (finding.relatedPackageId !== null) {
    const pkg = packageById.get(finding.relatedPackageId);
    if (pkg?.context.context) return pkg.context.context;
  }
  return { nodeType: "workspace", nodeId: workspaceId };
}

export function executionPackageFindingsToRecommendations(findings: PackageFinding[], packages: ExecutionPackage[], workspaceId: string): OperationalRecommendation[] {
  const packageById = new Map(packages.map((p) => [p.id, p] as const));
  return findings.map((finding) => ({
    ruleId: `execution_package.${finding.type}`,
    message: finding.description,
    severity: SEVERITY_MAP[finding.severity],
    node: resolveFindingNode(finding, packageById, workspaceId),
  }));
}
