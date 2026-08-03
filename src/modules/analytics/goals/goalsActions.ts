"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getExpenses, getEvents, getLeads } from "@/lib/data";
import { listGoalsForWorkspace, setGoal, deleteGoal } from "@/lib/data/core/analytics/goalsStore";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { filterInWindow } from "@/core/analytics/engine";
import type { Goal, GoalMetric, GoalProgress } from "@/types/businessIntelligence";
import type { Payment } from "@/types/payment";

const GENERIC_ACCESS_ERROR = "Goals & Targets isn't available. You may not have access to it.";

export type GoalsActionResult<T> = { success: true; data: T } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

async function computeCurrentValue(goal: Goal): Promise<{ currentValue: number | null }> {
  const window = { start: goal.period_start, end: goal.period_end };

  if (goal.metric === "monthlyRevenue" || goal.metric === "quarterlyRevenue" || goal.metric === "annualRevenue") {
    const payments = await getPayments();
    return { currentValue: filterInWindow(payments.filter(paymentCounts), (p) => p.transaction_date, window).reduce((sum, p) => sum + p.amount_minor, 0) };
  }
  if (goal.metric === "events") {
    const events = await getEvents({ includeArchived: false });
    const dated = events.filter((e) => e.event_date !== null && e.status !== "cancelled");
    return { currentValue: filterInWindow(dated, (e) => e.event_date as string, window).length };
  }
  if (goal.metric === "profit") {
    const [payments, expenses] = await Promise.all([getPayments(), getExpenses({ includeArchived: true })]);
    const collected = filterInWindow(payments.filter(paymentCounts), (p) => p.transaction_date, window).reduce((sum, p) => sum + p.amount_minor, 0);
    const cost = filterInWindow(
      expenses.filter((e) => e.status !== "cancelled"),
      (e) => e.transaction_date,
      window,
    ).reduce((sum, e) => sum + e.amount_minor, 0);
    return { currentValue: collected - cost };
  }
  if (goal.metric === "conversionRate") {
    const leads = await getLeads({ includeArchived: false });
    const cohort = filterInWindow(leads, (l) => l.created_at, window);
    if (cohort.length === 0) return { currentValue: 0 };
    return { currentValue: (cohort.filter((l) => l.converted_client_id !== null).length / cohort.length) * 100 };
  }
  // customerSatisfaction — no data source exists in BloomOS yet, same "honestly null" treatment as the Business Health Score's own customerSatisfaction dimension.
  return { currentValue: null };
}

function toProgress(goal: Goal, currentValue: number | null): GoalProgress {
  if (currentValue === null) return { goal, currentValue: null, progressPercent: null, onTrack: null };
  const progressPercent = goal.target_value === 0 ? 0 : (currentValue / goal.target_value) * 100;
  return { goal, currentValue, progressPercent, onTrack: currentValue >= goal.target_value };
}

/** v2 Checkpoint 23, Step 9 — Goals & Targets. Every current value is computed fresh from real data for the goal's own metric/period — never stored or estimated. */
export async function listGoalsProgressAction(): Promise<GoalsActionResult<GoalProgress[]>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const goals = listGoalsForWorkspace(session.workspace.id);
  const progress = await Promise.all(goals.map(async (goal) => toProgress(goal, (await computeCurrentValue(goal)).currentValue)));
  return { success: true, data: progress };
}

export interface SetGoalActionInput {
  metric: GoalMetric;
  periodStart: string;
  periodEnd: string;
  targetValue: number;
}

export async function setGoalAction(input: SetGoalActionInput): Promise<GoalsActionResult<Goal>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: "Only workspace owners/admins can set Goals & Targets." };
  if (input.targetValue < 0) return { success: false, error: "A target can't be negative." };
  if (input.periodEnd <= input.periodStart) return { success: false, error: "The period end must be after the period start." };

  const goal = setGoal({ workspaceId: session.workspace.id, metric: input.metric, periodStart: input.periodStart, periodEnd: input.periodEnd, targetValue: input.targetValue, createdBy: session.membership.id });
  return { success: true, data: goal };
}

export async function deleteGoalAction(goalId: string): Promise<GoalsActionResult<{ deleted: boolean }>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("workspace.manage")) return { success: false, error: "Only workspace owners/admins can remove Goals & Targets." };

  return { success: true, data: { deleted: deleteGoal(goalId) } };
}
