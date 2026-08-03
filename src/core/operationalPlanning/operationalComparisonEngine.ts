import type { ExecutionPhase, Deliverable, EvidenceRequirement, Milestone, OperationalHealthScores, CriticalPathResult, OperationalRiskLevel, OperationalPlanComparisonEntry, OperationalPlanComparisonResult } from "@/types/operationalPlanning";
import { flattenSteps } from "@/core/operationalPlanning/executionStepEngine";

/**
 * v2.0 Checkpoint 27.2, Step 15 — Operational Comparison Engine.
 * Compares multiple already-scored plans (e.g. two template-derived
 * proposals for the same event) — pure, deterministic; every risk level
 * and difference is a disclosed threshold over already-computed data,
 * never a judgment call.
 */

const RISK_HEALTH_THRESHOLDS = { low: 80, medium: 50 };
/** A spread of this many points or more across compared plans is called out as a genuine difference worth the reader's attention. */
const NOTABLE_COMPLEXITY_SPREAD_THRESHOLD = 5;

export interface ComparisonPlanInput {
  planId: string;
  planName: string;
  phases: ExecutionPhase[];
  deliverables: Deliverable[];
  evidenceRequirements: EvidenceRequirement[];
  milestones: Milestone[];
  health: OperationalHealthScores;
  criticalPath: CriticalPathResult;
  validationErrorCount: number;
}

/** Step count + total dependency-edge count — a simple, disclosed measure of "how much there is to coordinate," never a fabricated difficulty score. */
export function computeExecutionComplexity(phases: ExecutionPhase[]): number {
  const steps = flattenSteps(phases);
  const totalDependencies = steps.reduce((sum, s) => sum + s.dependencies.length, 0);
  return steps.length + totalDependencies;
}

/** Any blocking validation error makes a plan `"high"` risk outright, regardless of its health score — an unexecutable plan is never "medium" risk. */
export function resolveRiskLevel(health: OperationalHealthScores, validationErrorCount: number): OperationalRiskLevel {
  if (validationErrorCount > 0) return "high";
  if (health.overallOperationalHealth >= RISK_HEALTH_THRESHOLDS.low) return "low";
  if (health.overallOperationalHealth >= RISK_HEALTH_THRESHOLDS.medium) return "medium";
  return "high";
}

function buildEntry(input: ComparisonPlanInput): OperationalPlanComparisonEntry {
  return {
    planId: input.planId,
    planName: input.planName,
    executionComplexity: computeExecutionComplexity(input.phases),
    deliverableCount: input.deliverables.length,
    evidenceCount: input.evidenceRequirements.length,
    milestoneCount: input.milestones.length,
    health: input.health,
    criticalPath: input.criticalPath,
    riskLevel: resolveRiskLevel(input.health, input.validationErrorCount),
  };
}

export function compareOperationalPlans(plans: ComparisonPlanInput[]): OperationalPlanComparisonResult {
  const entries = plans.map(buildEntry);
  const differences: string[] = [];

  if (entries.length > 1) {
    const healthiest = entries.reduce((a, b) => (a.health.overallOperationalHealth >= b.health.overallOperationalHealth ? a : b));
    differences.push(`"${healthiest.planName}" has the highest operational health at ${healthiest.health.overallOperationalHealth}.`);

    const complexities = entries.map((e) => e.executionComplexity);
    const spread = Math.max(...complexities) - Math.min(...complexities);
    if (spread >= NOTABLE_COMPLEXITY_SPREAD_THRESHOLD) differences.push(`Execution complexity varies significantly across plans (spread of ${spread}).`);

    const highRiskCount = entries.filter((e) => e.riskLevel === "high").length;
    if (highRiskCount > 0) differences.push(`${highRiskCount} plan(s) carry high risk.`);
  }

  return { entries, differences };
}
