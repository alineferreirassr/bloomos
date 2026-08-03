import type { DecisionFactors } from "@/core/executiveDecisions/priorityEngine";
import type { DecisionScores, ReadinessResolution } from "@/types/executiveDecisions";

/**
 * v2.0 Checkpoint 25.7, Step 6 — Decision Scoring Engine. Every score is a
 * disclosed deterministic formula over the same `DecisionFactors`
 * `priorityEngine.ts` uses — no separate detection, no randomness.
 *
 * v2.0 Checkpoint 25.7 Closing Fix — `readiness` is accepted as its own
 * parameter, not read out of `factors.operationalReadiness`, so its
 * presence here is explicit at every call site. It is attached to the
 * returned `DecisionScores` as traceability metadata only — it does not
 * feed `urgencyScore`/`businessImpactScore`/`riskScore`/`complexityScore`.
 * Those four already represent age, business-rule severity, impact count,
 * and dependency count; adding readiness into them too would double-count
 * a signal `priorityEngine.computePriorityScore` already applies once,
 * which the Closing Fix's own stop condition forbids.
 */

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function computeDecisionScores(factors: DecisionFactors, readiness: ReadinessResolution): DecisionScores {
  const urgencyScore = clamp(factors.ageDays * 3 + (factors.businessRuleSeverity === "hard" ? 30 : 0) + (factors.objectiveBlocked ? 20 : 0));
  const businessImpactScore = clamp(factors.businessImpactCount * 15 + factors.blockingRelationshipsCount * 10);
  const riskScore = clamp((factors.businessRuleSeverity === "hard" ? 40 : factors.businessRuleSeverity === "soft" ? 10 : 0) + (factors.riskFlag ? 30 : 0) + factors.blockingRelationshipsCount * 10);
  const complexityScore = clamp(factors.dependencyCount * 10 + factors.businessImpactCount * 5);
  // Fraction of this decision's own dependencies already satisfied — higher is better, same "higher = healthier" convention every readiness-style score in this codebase follows.
  const dependencyScore = factors.dependencyCount === 0 ? 100 : clamp(((factors.dependencyCount - factors.unmetDependencyCount) / factors.dependencyCount) * 100);
  // Full confidence when the decision is anchored to real business impact; reduced, disclosed, for a floating issue with no measurable impact yet.
  const confidence = factors.businessImpactCount > 0 ? 100 : 60;

  const decisionScore = clamp((businessImpactScore + urgencyScore + riskScore) / 3);
  const overallExecutiveScore = clamp(decisionScore * (confidence / 100));

  return { decisionScore, urgencyScore, businessImpactScore, dependencyScore, riskScore, complexityScore, confidence, overallExecutiveScore, readiness };
}
