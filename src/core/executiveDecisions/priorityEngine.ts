import type { DecisionPriority } from "@/types/executiveDecisions";

/**
 * v2.0 Checkpoint 25.7, Step 2 — Priority Engine. A single deterministic
 * weighted composite over factors the caller has already resolved from
 * real data (`decisionScoringEngine.ts`/`executiveDecisionEngine.ts`
 * compute these, never this file) — no randomness, no AI, every weight
 * named and disclosed below.
 */

export interface DecisionFactors {
  /** How many real records this issue touches (related entities, dependents from Impact Analysis). */
  businessImpactCount: number;
  dependencyCount: number;
  unmetDependencyCount: number;
  /** Broken/circular/duplicate relationships tied to this decision's node. */
  blockingRelationshipsCount: number;
  /** 0-100 readiness score of the related node, or `null` when the decision isn't anchored to a readiness-evaluated entity. */
  operationalReadiness: number | null;
  objectiveBlocked: boolean;
  businessRuleSeverity: "hard" | "soft" | null;
  ageDays: number;
  /** Compliance/Security-category issues, or a circular dependency — flagged true regardless of the other factors. */
  riskFlag: boolean;
}

/** Disclosed weights — each factor's maximum contribution to the 0-100 composite, chosen so no single factor alone can push a decision into "critical." */
const WEIGHTS = {
  businessImpactPerUnit: 10,
  businessImpactCap: 30,
  unmetDependencyPerUnit: 15,
  unmetDependencyCap: 30,
  blockingRelationshipPerUnit: 10,
  blockingRelationshipCap: 20,
  readinessGapFactor: 0.2, // (100 - readiness) * factor, capped at 20
  readinessGapCap: 20,
  objectiveBlockedBonus: 15,
  hardRuleBonus: 15,
  agePerDay: 0.5,
  ageCap: 15,
  riskFlagBonus: 10,
};

/** Disclosed score-to-bucket thresholds — the composite is 0-100; a score at or above each threshold lands in that priority. */
const PRIORITY_THRESHOLDS: { min: number; priority: DecisionPriority }[] = [
  { min: 80, priority: "critical" },
  { min: 60, priority: "high" },
  { min: 35, priority: "medium" },
  { min: 15, priority: "low" },
  { min: 0, priority: "informational" },
];

/**
 * v2.0 Checkpoint 25.7 Closing Fix — the readiness-gap contribution,
 * pulled out on its own so `decisionEngine.resolveDecisionReadiness` can
 * report exactly how many of the composite's points a given readiness
 * value produced, without duplicating this formula a second time.
 * Direction is deliberate: readiness near 0 ("completely unready") makes
 * `(100 - readiness)` large, so it contributes close to the full
 * `readinessGapCap` — low readiness pushes priority up. Readiness near
 * 100 contributes close to 0 — high readiness doesn't inflate priority.
 */
export function computeReadinessPriorityContribution(operationalReadiness: number | null): number {
  if (operationalReadiness === null) return 0;
  return Math.min((100 - operationalReadiness) * WEIGHTS.readinessGapFactor, WEIGHTS.readinessGapCap);
}

export function computePriorityScore(factors: DecisionFactors): number {
  let score = 0;
  score += Math.min(factors.businessImpactCount * WEIGHTS.businessImpactPerUnit, WEIGHTS.businessImpactCap);
  score += Math.min(factors.unmetDependencyCount * WEIGHTS.unmetDependencyPerUnit, WEIGHTS.unmetDependencyCap);
  score += Math.min(factors.blockingRelationshipsCount * WEIGHTS.blockingRelationshipPerUnit, WEIGHTS.blockingRelationshipCap);
  score += computeReadinessPriorityContribution(factors.operationalReadiness);
  if (factors.objectiveBlocked) score += WEIGHTS.objectiveBlockedBonus;
  if (factors.businessRuleSeverity === "hard") score += WEIGHTS.hardRuleBonus;
  score += Math.min(factors.ageDays * WEIGHTS.agePerDay, WEIGHTS.ageCap);
  if (factors.riskFlag) score += WEIGHTS.riskFlagBonus;

  return Math.min(100, Math.round(score));
}

export function computePriority(factors: DecisionFactors): DecisionPriority {
  const score = computePriorityScore(factors);
  return PRIORITY_THRESHOLDS.find((t) => score >= t.min)!.priority;
}
