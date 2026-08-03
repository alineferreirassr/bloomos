import type { OperationsCenterHealthScores } from "@/types/operationsCenter";

/**
 * v2.0 Checkpoint 31, Step 10 — Operations Center Health Composition.
 * Every component score below is either a direct reuse of another
 * module's own already-computed health output, or a plain average of a
 * per-record array of those same reused scores — this engine never
 * recalculates any module's own internal health formula. The two
 * exceptions, disclosed here rather than hidden:
 *
 * - `knowledgeHealth` normalizes `KnowledgeHealthReport`'s raw issue
 *   lists into a single 0-100 figure (`100 - issueCount * 5`, floored at
 *   0) since that report itself exposes no single score — this is a
 *   normalization step over already-computed lists, not a recalculation
 *   of `computeKnowledgeHealth`'s own logic (which stays untouched).
 * - `allocationHealth` is a severity-count penalty proxy
 *   (`100 - highCount*10 - mediumCount*5`, floored at 0) for the same
 *   reason: Resource Allocation exposes findings, not a single bulk
 *   score.
 * - `workforceHealth` is `availableNow / totalWorkers`, a ratio of two
 *   numbers Workforce's own `WorkforceScorecard` already computed — never
 *   a new availability/eligibility calculation of its own.
 *
 * Weighting: `overallOperationsCenterHealth` is an unweighted average of
 * all 10 component scores. No input feeds more than one component, so
 * there is no double counting between them.
 */
export interface HealthCompositionInput {
  businessHealthScore: number;
  objectiveHealthScore: number;
  packageHealthScores: number[];
  schedulingHealthScores: number[];
  knowledgeIssueCount: number;
  allocationFindingCounts: { high: number; medium: number };
  workforceScorecard: { availableNow: number; totalWorkers: number } | null;
  dispatchHealthScores: number[];
  executionHealthScores: number[];
  routeHealthScores: number[];
}

function average(values: number[]): number {
  if (values.length === 0) return 100;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

export function computeOperationsCenterHealth(input: HealthCompositionInput): OperationsCenterHealthScores {
  const knowledgeHealth = Math.max(0, 100 - input.knowledgeIssueCount * 5);
  const allocationHealth = Math.max(0, 100 - input.allocationFindingCounts.high * 10 - input.allocationFindingCounts.medium * 5);
  const workforceHealth = !input.workforceScorecard || input.workforceScorecard.totalWorkers === 0 ? 100 : Math.round((input.workforceScorecard.availableNow / input.workforceScorecard.totalWorkers) * 100);

  const dispatchHealth = average(input.dispatchHealthScores);
  const executionHealth = average(input.executionHealthScores);
  const routeHealth = average(input.routeHealthScores);
  const schedulingHealth = average(input.schedulingHealthScores);
  const packageHealth = average(input.packageHealthScores);
  const businessHealth = input.businessHealthScore;
  const objectiveHealth = input.objectiveHealthScore;

  const components = [dispatchHealth, executionHealth, routeHealth, schedulingHealth, allocationHealth, packageHealth, workforceHealth, businessHealth, knowledgeHealth, objectiveHealth];
  const overallOperationsCenterHealth = Math.round(components.reduce((sum, v) => sum + v, 0) / components.length);

  return {
    dispatchHealth,
    executionHealth,
    routeHealth,
    schedulingHealth,
    allocationHealth,
    packageHealth,
    workforceHealth,
    businessHealth,
    knowledgeHealth,
    objectiveHealth,
    overallOperationsCenterHealth,
  };
}
