import {
  EVENT_STATUSES,
  LOCKED_EVENT_STATUSES,
  WORKING_EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  type EventStatus,
} from "@/core/enums/eventStatus";
import {
  EVENT_LIFECYCLE_STAGES,
  LOCKED_EVENT_LIFECYCLE_STAGES,
  WORKING_EVENT_LIFECYCLE_STAGES,
  EVENT_LIFECYCLE_STAGE_LABELS,
  type EventLifecycleStage,
} from "@/core/enums/eventLifecycleStage";

/**
 * The canonical Event lifecycle. Single source of truth for which statuses
 * and lifecycle stages exist and which transitions are legal — the data
 * layer (lib/data/index.ts) is the only consumer today; future Event UI
 * will consume it the same way LeadStatusSelect/ClientStatusSelect consume
 * leadWorkflow/clientWorkflow.
 *
 * status and lifecycle_stage are two independent state machines. status is
 * the operational/booking state (draft, awaiting_contract, confirmed...);
 * lifecycle_stage is where the event sits in the planning pipeline (intake,
 * planning, execution...). Neither is inferred from the other by string
 * matching — each has its own transition table and its own setter
 * (updateEventStatus / updateEventLifecycleStage).
 */
export {
  EVENT_STATUSES,
  LOCKED_EVENT_STATUSES,
  WORKING_EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  EVENT_LIFECYCLE_STAGES,
  LOCKED_EVENT_LIFECYCLE_STAGES,
  WORKING_EVENT_LIFECYCLE_STAGES,
  EVENT_LIFECYCLE_STAGE_LABELS,
};
export type { EventStatus, EventLifecycleStage };

/**
 * True for a status reachable only through its own dedicated action
 * (Complete, Cancel, Archive) — never the plain status selector, and never
 * left once entered.
 */
export function isEventTerminal(status: EventStatus): boolean {
  return LOCKED_EVENT_STATUSES.includes(status);
}

/**
 * The authoritative status transition rule, mirroring leadWorkflow's
 * canTransition: a locked status is terminal; any other status can move
 * freely to any other non-locked status, so the team can correct a status
 * by hand without fighting a strict linear funnel. completed/cancelled/
 * archived are reachable only via completeEvent/cancelEvent/archiveEvent.
 */
export function canTransitionEventStatus(from: EventStatus, to: EventStatus): boolean {
  if (isEventTerminal(from)) return false;
  if (from === to) return false;
  return WORKING_EVENT_STATUSES.includes(to);
}

/** Every status `from` can legally move to right now (empty once terminal). */
export function getNextEventStatuses(from: EventStatus): EventStatus[] {
  if (isEventTerminal(from)) return [];
  return WORKING_EVENT_STATUSES.filter((status) => canTransitionEventStatus(from, status));
}

/** True for a lifecycle stage reachable only once an Event is fully wrapped up. */
export function isLifecycleStageTerminal(stage: EventLifecycleStage): boolean {
  return LOCKED_EVENT_LIFECYCLE_STAGES.includes(stage);
}

/**
 * Unlike status, there's no dedicated "close" action in the data layer —
 * closing a lifecycle IS the ordinary transition, just into the one stage
 * that happens to be terminal. So "closed" must stay reachable through this
 * same selector (unlike completed/cancelled/archived on the status side,
 * which are only reachable via their own dedicated action). Once entered,
 * closed can't be left — isLifecycleStageTerminal still blocks moving `from`
 * it.
 */
export function canTransitionLifecycleStage(
  from: EventLifecycleStage,
  to: EventLifecycleStage,
): boolean {
  if (isLifecycleStageTerminal(from)) return false;
  if (from === to) return false;
  return true;
}

/** Every lifecycle stage `from` can legally move to right now (empty once closed). */
export function getNextLifecycleStages(from: EventLifecycleStage): EventLifecycleStage[] {
  if (isLifecycleStageTerminal(from)) return [];
  return EVENT_LIFECYCLE_STAGES.filter((stage) => canTransitionLifecycleStage(from, stage));
}

interface EventForNextAction {
  status: EventStatus;
  event_date: string | null;
  location_name: string | null;
  address: string | null;
  budget_min: number | null;
  budget_max: number | null;
}

interface EventNextActionContext {
  hasChecklistItems: boolean;
  hasOverdueChecklistItems: boolean;
  hasScheduleItems: boolean;
  /** No post-event-review entity/module exists yet — callers pass false until it's built. */
  hasPostEventReview: boolean;
  /** Whole days from now until event_date; null when there's no date to compare (already handled earlier by the missing-date check, but kept nullable for safety). */
  daysUntilEvent: number | null;
}

const APPROACHING_WINDOW_DAYS = 7;

/**
 * Short, human-readable, deterministic suggestion for what to do next with
 * this Event — mirrors getNextRecommendedAction (Lead) and
 * getClientNextRecommendedAction (Client). Checked in a fixed priority
 * order — missing intake info first, then booking placeholders, then
 * planning gaps, then timing, then wrap-up — so the same Event state always
 * produces the same suggestion. Archived and cancelled Events get none.
 */
export function getEventNextRecommendedAction(
  event: EventForNextAction,
  context: EventNextActionContext,
): string | null {
  if (event.status === "archived" || event.status === "cancelled") return null;

  if (event.status === "draft") {
    return "Complete the event details to move it out of draft";
  }

  if (!event.event_date) {
    return "Set the event date";
  }

  if (!event.location_name && !event.address) {
    return "Add the event location";
  }

  if (event.budget_min === null && event.budget_max === null) {
    return "Set a budget range";
  }

  if (event.status === "awaiting_contract") {
    return "Send the contract";
  }

  if (event.status === "awaiting_deposit") {
    return "Collect the deposit";
  }

  if (!context.hasChecklistItems) {
    return "Create a checklist for this event";
  }

  if (context.hasOverdueChecklistItems) {
    return "Resolve overdue checklist items";
  }

  if (!context.hasScheduleItems) {
    return "Build the day-of schedule";
  }

  if (
    context.daysUntilEvent !== null &&
    context.daysUntilEvent >= 0 &&
    context.daysUntilEvent <= APPROACHING_WINDOW_DAYS &&
    event.status !== "ready" &&
    event.status !== "in_progress" &&
    event.status !== "completed"
  ) {
    return "Event is approaching — confirm readiness";
  }

  if (event.status === "completed" && !context.hasPostEventReview) {
    return "Complete the post-event review";
  }

  return null;
}
