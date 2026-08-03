import { generateId, nowIso } from "@/lib/data/utils";
import type { Goal, GoalMetric } from "@/types/businessIntelligence";

/**
 * v2 Checkpoint 23, Step 9 — Goals & Targets. Mock-only, same
 * "new checkpoint domain, mock-only this phase" precedent as
 * `dashboardLayoutStore.ts`/`webhookEndpointStore.ts`. One Goal per
 * `workspace_id` + `metric` + `period_start` — creating a new Goal for the
 * same metric/period replaces (rather than duplicates) the prior target,
 * matching the "owners redefine, not stack, their own targets" expectation.
 */
let goals: Goal[] = [];

export function resetGoalsStore(): void {
  goals = [];
}

export function listGoalsForWorkspace(workspaceId: string): Goal[] {
  return goals.filter((goal) => goal.workspace_id === workspaceId).sort((a, b) => b.period_start.localeCompare(a.period_start));
}

export function getGoalById(id: string): Goal | null {
  return goals.find((goal) => goal.id === id) ?? null;
}

export interface SetGoalInput {
  workspaceId: string;
  metric: GoalMetric;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
  createdBy: string;
}

export function setGoal(input: SetGoalInput): Goal {
  const now = nowIso();
  const existing = goals.find((goal) => goal.workspace_id === input.workspaceId && goal.metric === input.metric && goal.period_start === input.periodStart);
  if (existing) {
    const updated: Goal = { ...existing, target_value: input.targetValue, period_end: input.periodEnd, updated_at: now };
    goals = goals.map((goal) => (goal.id === existing.id ? updated : goal));
    return updated;
  }
  const created: Goal = {
    id: generateId("goal"),
    workspace_id: input.workspaceId,
    metric: input.metric,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    target_value: input.targetValue,
    created_by: input.createdBy,
    created_at: now,
    updated_at: now,
  };
  goals = [...goals, created];
  return created;
}

export function deleteGoal(id: string): boolean {
  const existed = goals.some((goal) => goal.id === id);
  goals = goals.filter((goal) => goal.id !== id);
  return existed;
}
