import type { WorkspaceExecutiveScorecard } from "@/types/executiveDecisions";

/**
 * v2.0 Checkpoint 25.7, Step 11 — Workspace Scorecard. Every input is a
 * number some earlier engine already computed — this file only averages
 * and blends, never recomputes a health/readiness signal itself.
 */

export interface ComputeExecutiveScorecardInput {
  /** `BusinessHealthReport.overallScore` (Step 15.5), reused directly. */
  businessHealthOverallScore: number;
  /** The `knowledge_health` category's own score from `BusinessHealthReport.categories` (Step 15.5); `null` when that category is itself `notApplicable`. */
  knowledgeHealthCategoryScore: number | null;
  /** `WorkspaceScorecard.overallOperationalScore` (Step 15.6), reused directly. */
  objectiveOverallOperationalScore: number;
  /** `WorkspaceScorecard.operationalProgress` (Step 15.6) — reused as this scorecard's own "Operational Score," not recomputed. */
  operationalProgress: number;
  /** Every `ReadinessScore.overallScore` currently on record (Step 15.5). */
  readinessScores: number[];
  /** `DecisionScores.decisionScore` for every currently open Decision (Step 6). */
  openDecisionScores: number[];
  evaluatedAt: string;
}

function average(values: number[], fallback: number): number {
  if (values.length === 0) return fallback;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeExecutiveScorecard(input: ComputeExecutiveScorecardInput): WorkspaceExecutiveScorecard {
  const businessScore = input.businessHealthOverallScore;
  const objectiveScore = input.objectiveOverallOperationalScore;
  const operationalScore = input.operationalProgress;
  const readinessScore = average(input.readinessScores, 100);
  const knowledgeScore = input.knowledgeHealthCategoryScore ?? 100;
  const decisionScore = average(input.openDecisionScores, 100);

  // A disclosed, even blend of six already-computed scores — not a prediction.
  const overallExecutiveScore = Math.round((businessScore + objectiveScore + operationalScore + readinessScore + knowledgeScore + decisionScore) / 6);

  return { operationalScore, businessScore, decisionScore, readinessScore, knowledgeScore, objectiveScore, overallExecutiveScore, evaluatedAt: input.evaluatedAt };
}
