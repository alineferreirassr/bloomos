import type { ObjectiveEffectiveStatus, ObjectiveProgress, WorkspaceScorecard } from "@/types/objectives";

/**
 * v2.0 Checkpoint 25, Step 15.6 — Scorecard Engine. A pure aggregation
 * over already-computed objective state — never re-detects anything.
 * `businessReadiness` is `BusinessHealthReport.overallScore` (Step 15.5)
 * passed straight through, not recomputed.
 */

export interface ScorecardInput {
  /** One effective status per objective (`objectiveEngine.deriveEffectiveStatus`'s output), keyed by objective id. */
  effectiveStatuses: Map<string, ObjectiveEffectiveStatus>;
  progresses: ObjectiveProgress[];
  businessHealthOverallScore: number;
  evaluatedAt: string;
}

export function computeWorkspaceScorecard(input: ScorecardInput): WorkspaceScorecard {
  const statuses = Array.from(input.effectiveStatuses.values());
  const objectivesCompleted = statuses.filter((s) => s === "completed").length;
  const objectivesBlocked = statuses.filter((s) => s === "blocked").length;
  const objectivesOverdue = statuses.filter((s) => s === "overdue").length;

  // Average completion — the mean of every objective's own completion %, a continuous "how far along" snapshot.
  const averageCompletion = input.progresses.length === 0 ? 100 : Math.round(input.progresses.reduce((sum, p) => sum + p.completionPercent, 0) / input.progresses.length);

  // Operational progress — distinct from averageCompletion: the *rate* of objectives that have actually crossed the finish line, not how close the rest are.
  const operationalProgress = statuses.length === 0 ? 100 : Math.round((objectivesCompleted / statuses.length) * 100);

  // A disclosed, even blend of "how far objectives have progressed" and "how healthy the underlying business data is" — not a prediction, just an average of two already-computed numbers.
  const overallOperationalScore = Math.round((averageCompletion + input.businessHealthOverallScore) / 2);

  return {
    objectivesCompleted,
    objectivesBlocked,
    objectivesOverdue,
    averageCompletion,
    operationalProgress,
    businessReadiness: input.businessHealthOverallScore,
    overallOperationalScore,
    evaluatedAt: input.evaluatedAt,
  };
}
