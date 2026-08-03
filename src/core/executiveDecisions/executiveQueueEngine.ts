import { DECISION_PRIORITIES, type Decision, type DecisionPriority, type DecisionScores } from "@/types/executiveDecisions";

/**
 * v2.0 Checkpoint 25.7, Step 4 — Executive Queue Engine. Deterministic
 * ordering only — never randomness, never a new scoring mechanism.
 * Ordering key: priority bucket (critical first), then
 * `DecisionScores.overallExecutiveScore` descending (Step 6, already
 * computed), then `created_at` ascending — older ties surface first, so
 * two decisions of identical priority and score don't reorder themselves
 * on every re-evaluation.
 */

const PRIORITY_ORDER: Record<DecisionPriority, number> = Object.fromEntries(DECISION_PRIORITIES.map((p, i) => [p, i])) as Record<DecisionPriority, number>;

export function isQueueEligible(decision: Decision): boolean {
  return decision.status !== "resolved" && decision.status !== "archived";
}

export function orderExecutiveQueue(decisions: Decision[], scoresById: Map<string, DecisionScores>): Decision[] {
  return [...decisions].sort((a, b) => {
    const priorityDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    const scoreA = scoresById.get(a.id)?.overallExecutiveScore ?? 0;
    const scoreB = scoresById.get(b.id)?.overallExecutiveScore ?? 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function buildExecutiveQueue(decisions: Decision[], scoresById: Map<string, DecisionScores>): Decision[] {
  return orderExecutiveQueue(decisions.filter(isQueueEligible), scoresById);
}
