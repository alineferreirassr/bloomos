import type { WorkspaceHealthBand, WorkspaceHealthSummary, WorkspacePlatformHealthEntry } from "@/types/smartWorkspace";

/**
 * v2.0 Checkpoint 38, Step 5 — Workspace Health Aggregator. Every score
 * below is either a direct reuse of another platform's own already-computed
 * health output, or a plain average of a per-record array of those same
 * reused scores — this engine never recalculates any platform's own
 * internal health formula. This is the same "compose, don't duplicate"
 * discipline `operationsCenterHealthEngine.ts` (Checkpoint 31) already
 * established for its own 10-component composite — and in fact this
 * engine's own `operationalHealthScore` input IS that exact composite,
 * reused rather than re-derived, folding Dispatch/Field Operations/Route
 * Optimization/Scheduling/Resource Allocation/Execution Package/Workforce/
 * Business Health/Knowledge/Objectives into one number for free.
 *
 * Two disclosed proxy scores, same precedent as `operationsCenterHealthEngine.ts`'s
 * own `allocationHealth`/`knowledgeHealth`:
 * - `assetHealth` is a direct passthrough of Digital Assets' own
 *   `PlatformHealthSummary.averageScore`/`.band` (Checkpoint 37) — not a proxy.
 * - `capabilityHealth` IS a proxy: Capability Coverage
 *   (`evaluateWorkforceCapabilityCoverageAction`) exposes no single score,
 *   only `uncoveredRequirementIds`/`highRiskGapsCount` — normalized here
 *   the same way `operationsCenterHealthEngine.ts` normalizes Resource
 *   Allocation's own finding counts into a 0-100 figure.
 *
 * Bands use the same 90/70/40 threshold convention `healthEngine.ts`
 * (Checkpoint 37, Digital Assets) already established, so a "good" score
 * means the same thing everywhere in BloomOS.
 */

export interface WorkspaceHealthInput {
  operationalHealthScore: number;
  assetHealth: { score: number; band: WorkspaceHealthBand } | null;
  proposalHealthScores: number[];
  contractHealthScores: number[];
  invoiceHealthScores: number[];
  journeyHealthScores: number[];
  capabilityGaps: { uncoveredRequirementCount: number; highRiskGapsCount: number };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function bandForScore(score: number): WorkspaceHealthBand {
  if (score >= 90) return "excellent";
  if (score >= 70) return "good";
  if (score >= 40) return "attention";
  return "critical";
}

function capabilityHealthProxy(gaps: { uncoveredRequirementCount: number; highRiskGapsCount: number }): number {
  return Math.max(0, 100 - gaps.uncoveredRequirementCount * 5 - gaps.highRiskGapsCount * 10);
}

export function aggregateWorkspaceHealth(workspaceId: string, input: WorkspaceHealthInput, evaluatedAt: string): WorkspaceHealthSummary {
  const platforms: WorkspacePlatformHealthEntry[] = [];

  platforms.push({
    key: "operational",
    label: "Operational Health",
    score: input.operationalHealthScore,
    band: bandForScore(input.operationalHealthScore),
    sourceAction: "evaluateOperationsCenterAction (Checkpoint 31) — itself already composes 10 platforms",
    isProxy: false,
  });

  if (input.assetHealth) {
    platforms.push({
      key: "assets",
      label: "Digital Asset Health",
      score: input.assetHealth.score,
      band: input.assetHealth.band,
      sourceAction: "evaluatePlatformAction (Checkpoint 37, Digital Assets)",
      isProxy: false,
    });
  }

  const proposalScore = average(input.proposalHealthScores);
  if (proposalScore !== null) {
    platforms.push({
      key: "proposals",
      label: "Proposal Health",
      score: proposalScore,
      band: bandForScore(proposalScore),
      sourceAction: "listProposalSummariesAction — averaged per-proposal overallHealthScore",
      isProxy: false,
    });
  }

  const contractScore = average(input.contractHealthScores);
  if (contractScore !== null) {
    platforms.push({
      key: "contracts",
      label: "Contract Health",
      score: contractScore,
      band: bandForScore(contractScore),
      sourceAction: "listContractSummariesAction — averaged per-contract overallHealthScore",
      isProxy: false,
    });
  }

  const invoiceScore = average(input.invoiceHealthScores);
  if (invoiceScore !== null) {
    platforms.push({
      key: "invoices",
      label: "Invoice Health",
      score: invoiceScore,
      band: bandForScore(invoiceScore),
      sourceAction: "listInvoiceSummariesAction — averaged per-invoice overallHealthScore",
      isProxy: false,
    });
  }

  const journeyScore = average(input.journeyHealthScores);
  if (journeyScore !== null) {
    platforms.push({
      key: "journeys",
      label: "Client Journey Health",
      score: journeyScore,
      band: bandForScore(journeyScore),
      sourceAction: "listClientJourneysAction — averaged per-journey overallHealth",
      isProxy: false,
    });
  }

  const capabilityScore = capabilityHealthProxy(input.capabilityGaps);
  platforms.push({
    key: "capability",
    label: "Workforce Capability Health",
    score: capabilityScore,
    band: bandForScore(capabilityScore),
    sourceAction: "evaluateWorkforceCapabilityCoverageAction — normalized from uncovered/high-risk-gap counts (no native score)",
    isProxy: true,
  });

  const overallScore = Math.round(platforms.reduce((sum, p) => sum + p.score, 0) / platforms.length);

  return {
    workspace_id: workspaceId,
    overallScore,
    band: bandForScore(overallScore),
    platforms,
    evaluatedAt,
  };
}
