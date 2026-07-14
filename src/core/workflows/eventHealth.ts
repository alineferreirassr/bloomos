import type { EventStatus } from "@/core/enums/eventStatus";
import type { EventPriority } from "@/core/enums/eventPriority";

/**
 * Preparation only — no UI, no Dashboard widget yet. A single reusable
 * scoring function so a future Event detail page or Dashboard card can
 * surface "how healthy is this event" without inventing its own logic.
 *
 * Deduction-based: starts at 100, loses points per real gap, floors at 0.
 * Deliberately separate from getEventNextRecommendedAction (eventWorkflow.ts)
 * — that function picks ONE next action to show; this one produces a
 * continuous score across every factor at once. Both read similar signals
 * but serve different purposes, so they aren't merged into one function.
 */

const DEDUCTIONS = {
  missingLocation: 15,
  missingBudget: 10,
  missingChecklist: 15,
  overdueChecklist: 15,
  missingSchedule: 10,
  awaitingContract: 10,
  awaitingDeposit: 10,
  criticalPriority: 5,
  approachingDate: 10,
  missingPostEventReview: 10,
} as const;

const APPROACHING_WINDOW_DAYS = 7;

export interface EventHealthInput {
  status: EventStatus;
  priority: EventPriority;
  location_name: string | null;
  address: string | null;
  budget_min: number | null;
  budget_max: number | null;
}

export interface EventHealthContext {
  hasChecklistItems: boolean;
  hasOverdueChecklistItems: boolean;
  hasScheduleItems: boolean;
  hasPostEventReview: boolean;
  /** Whole days from now until event_date; null when there's no date. */
  daysUntilEvent: number | null;
}

/** 0–100. 100 = nothing flagged; each factor below deducts independently, so multiple gaps compound. */
export function getEventHealthScore(event: EventHealthInput, context: EventHealthContext): number {
  let score = 100;

  if (!event.location_name && !event.address) {
    score -= DEDUCTIONS.missingLocation;
  }
  if (event.budget_min === null && event.budget_max === null) {
    score -= DEDUCTIONS.missingBudget;
  }
  if (!context.hasChecklistItems) {
    score -= DEDUCTIONS.missingChecklist;
  }
  if (context.hasOverdueChecklistItems) {
    score -= DEDUCTIONS.overdueChecklist;
  }
  if (!context.hasScheduleItems) {
    score -= DEDUCTIONS.missingSchedule;
  }
  if (event.status === "awaiting_contract") {
    score -= DEDUCTIONS.awaitingContract;
  }
  if (event.status === "awaiting_deposit") {
    score -= DEDUCTIONS.awaitingDeposit;
  }
  if (event.priority === "critical") {
    score -= DEDUCTIONS.criticalPriority;
  }
  if (
    context.daysUntilEvent !== null &&
    context.daysUntilEvent >= 0 &&
    context.daysUntilEvent <= APPROACHING_WINDOW_DAYS &&
    event.status !== "ready" &&
    event.status !== "in_progress" &&
    event.status !== "completed"
  ) {
    score -= DEDUCTIONS.approachingDate;
  }
  if (event.status === "completed" && !context.hasPostEventReview) {
    score -= DEDUCTIONS.missingPostEventReview;
  }

  return Math.max(0, Math.min(100, score));
}
