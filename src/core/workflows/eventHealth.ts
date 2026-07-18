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

export interface EventHealthFactor {
  label: string;
  deduction: number;
}

const FACTOR_LABELS: Record<keyof typeof DEDUCTIONS, string> = {
  missingLocation: "Missing location",
  missingBudget: "Missing budget",
  missingChecklist: "No checklist items",
  overdueChecklist: "Overdue checklist items",
  missingSchedule: "No schedule items",
  awaitingContract: "Awaiting contract",
  awaitingDeposit: "Awaiting deposit",
  criticalPriority: "Critical priority",
  approachingDate: "Event approaching, not yet ready",
  missingPostEventReview: "Missing post-event review",
};

/**
 * The single source of deduction logic — both getEventHealthScore and
 * getEventHealthDetails call this rather than each re-implementing the same
 * checks, so the two can never drift out of sync with each other.
 */
function getTriggeredFactors(event: EventHealthInput, context: EventHealthContext): EventHealthFactor[] {
  const factors: EventHealthFactor[] = [];
  const add = (key: keyof typeof DEDUCTIONS) => {
    factors.push({ label: FACTOR_LABELS[key], deduction: DEDUCTIONS[key] });
  };

  if (!event.location_name && !event.address) {
    add("missingLocation");
  }
  if (event.budget_min === null && event.budget_max === null) {
    add("missingBudget");
  }
  if (!context.hasChecklistItems) {
    add("missingChecklist");
  }
  if (context.hasOverdueChecklistItems) {
    add("overdueChecklist");
  }
  if (!context.hasScheduleItems) {
    add("missingSchedule");
  }
  if (event.status === "awaiting_contract") {
    add("awaitingContract");
  }
  if (event.status === "awaiting_deposit") {
    add("awaitingDeposit");
  }
  if (event.priority === "critical") {
    add("criticalPriority");
  }
  if (
    context.daysUntilEvent !== null &&
    context.daysUntilEvent >= 0 &&
    context.daysUntilEvent <= APPROACHING_WINDOW_DAYS &&
    event.status !== "ready" &&
    event.status !== "in_progress" &&
    event.status !== "completed"
  ) {
    add("approachingDate");
  }
  if (event.status === "completed" && !context.hasPostEventReview) {
    add("missingPostEventReview");
  }

  return factors;
}

/** 0–100. 100 = nothing flagged; each factor below deducts independently, so multiple gaps compound. */
export function getEventHealthScore(event: EventHealthInput, context: EventHealthContext): number {
  const deducted = getTriggeredFactors(event, context).reduce((sum, factor) => sum + factor.deduction, 0);
  return Math.max(0, Math.min(100, 100 - deducted));
}

export interface EventHealthDetails {
  score: number;
  /** Every triggered factor, largest deduction first — "top risks" is just the head of this list. */
  factors: EventHealthFactor[];
}

/**
 * Same underlying signals as getEventHealthScore, plus which factors
 * triggered and by how much — for a future Event Detail health card. Never
 * duplicates the deduction rules; both functions call getTriggeredFactors.
 */
export function getEventHealthDetails(event: EventHealthInput, context: EventHealthContext): EventHealthDetails {
  const factors = getTriggeredFactors(event, context).sort((a, b) => b.deduction - a.deduction);
  const score = getEventHealthScore(event, context);
  return { score, factors };
}

export type EventHealthStatus = "ready" | "waiting" | "blocked";

/**
 * Condition-based classification for the Operational Pipeline's Kanban card
 * badge (Booking Workflow, Phase 2) — Ready/Waiting/Blocked, not the
 * continuous 0-100 score above. Per the approved design: classify by
 * blocking conditions, using the score only as the Ready/Waiting split once
 * nothing is actively blocking. "Blocked" is reserved for conditions that
 * stop forward progress outright (no signed contract, no deposit, an
 * overdue checklist item) — never just a missing nice-to-have field, which
 * only ever demotes an Event to "Waiting."
 */
export function getEventHealthStatus(event: EventHealthInput, context: EventHealthContext): EventHealthStatus {
  if (event.status === "awaiting_contract" || event.status === "awaiting_deposit" || context.hasOverdueChecklistItems) {
    return "blocked";
  }
  return getEventHealthScore(event, context) === 100 ? "ready" : "waiting";
}
