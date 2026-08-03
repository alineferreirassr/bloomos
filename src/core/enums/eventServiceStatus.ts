/**
 * The lifecycle of one Service assigned to one Event — independent of the
 * Event's own status and independent of the catalog Service's status (an
 * EventService keeps running its own lifecycle even if the catalog Service
 * is later deactivated). See core/workflows/eventServiceWorkflow.ts.
 */
export const EVENT_SERVICE_STATUSES = ["proposed", "confirmed", "in_progress", "completed", "cancelled"] as const;

export type EventServiceStatus = (typeof EVENT_SERVICE_STATUSES)[number];

export const EVENT_SERVICE_STATUS_LABELS: Record<EventServiceStatus, string> = {
  proposed: "Proposed",
  confirmed: "Confirmed",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};
