import { deriveEffectiveStatus, type DependencyEvaluation } from "@/core/objectives/objectiveEngine";
import { recommendationsFromMissingRequirements } from "@/core/knowledge/operationalRecommendationEngine";
import type { Objective, ObjectiveHealth, ObjectiveHealthState, ObjectiveProgress } from "@/types/objectives";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Objective Health Engine. A categorization
 * layer over `progressEngine.ts`'s raw numbers and `objectiveEngine.ts`'s
 * dependency evaluation — it detects nothing itself, only classifies.
 * Recommendations reuse `operationalRecommendationEngine.ts` (Step 15.5)
 * directly rather than a second recommendation mechanism.
 */

/** Disclosed heuristic thresholds, not a business rule read off any record — same pattern as `workspaceHealthEngine.ts`'s `OVERDUE_APPROVAL_THRESHOLD_DAYS`. */
const ON_TRACK_COMPLETION_THRESHOLD = 70;
const AT_RISK_COMPLETION_THRESHOLD = 30;

export function computeObjectiveHealth(objective: Objective, progress: ObjectiveProgress, dependencyEvaluations: DependencyEvaluation[], now: string): ObjectiveHealth {
  const effectiveStatus = deriveEffectiveStatus(objective, now);
  const unmetDependencies = dependencyEvaluations.filter((d) => !d.satisfied);
  const reasons: string[] = [];

  let state: ObjectiveHealthState;
  if (effectiveStatus === "blocked" || unmetDependencies.length > 0) {
    state = "blocked";
    reasons.push(...unmetDependencies.map((d) => d.detail));
  } else if (effectiveStatus === "completed" || effectiveStatus === "archived") {
    state = "on_track";
  } else if (effectiveStatus === "overdue") {
    state = "off_track";
    reasons.push("Past its due date.");
  } else if (progress.completionPercent >= ON_TRACK_COMPLETION_THRESHOLD) {
    state = "on_track";
  } else if (progress.completionPercent >= AT_RISK_COMPLETION_THRESHOLD) {
    state = "at_risk";
  } else {
    state = "off_track";
  }

  reasons.push(...progress.missingRequirements);

  const node = objective.node ?? { nodeType: "workspace" as const, nodeId: objective.workspace_id };
  const recommendations = recommendationsFromMissingRequirements(node, progress.missingRequirements);

  return { objectiveId: objective.id, state, effectiveStatus, reasons: Array.from(new Set(reasons)), recommendations };
}
