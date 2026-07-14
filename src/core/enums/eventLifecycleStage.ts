export const EVENT_LIFECYCLE_STAGES = [
  "intake",
  "proposal",
  "booking",
  "planning",
  "preparation",
  "setup",
  "execution",
  "live_event",
  "breakdown",
  "post_event",
  "closed",
] as const;

export type EventLifecycleStage = (typeof EVENT_LIFECYCLE_STAGES)[number];

export const EVENT_LIFECYCLE_STAGE_LABELS: Record<EventLifecycleStage, string> = {
  intake: "Intake",
  proposal: "Proposal",
  booking: "Booking",
  planning: "Planning",
  preparation: "Preparation",
  setup: "Setup",
  execution: "Execution",
  live_event: "Live Event",
  breakdown: "Breakdown",
  post_event: "Post-Event",
  closed: "Closed",
};

/** Reachable only once an Event is fully wrapped up — never selectable to move backward out of. */
export const LOCKED_EVENT_LIFECYCLE_STAGES: EventLifecycleStage[] = ["closed"];

/** Stages selectable from the ordinary lifecycle-stage selector. */
export const WORKING_EVENT_LIFECYCLE_STAGES: EventLifecycleStage[] = EVENT_LIFECYCLE_STAGES.filter(
  (stage) => !LOCKED_EVENT_LIFECYCLE_STAGES.includes(stage),
);
