export const EVENT_STATUSES = [
  "draft",
  "inquiry",
  "awaiting_contract",
  "awaiting_deposit",
  "confirmed",
  "planning",
  "ready",
  "in_progress",
  "completed",
  "cancelled",
  "archived",
] as const;

export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Draft",
  inquiry: "Inquiry",
  awaiting_contract: "Awaiting Contract",
  awaiting_deposit: "Awaiting Deposit",
  confirmed: "Confirmed",
  planning: "Planning",
  ready: "Ready",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
  archived: "Archived",
};

/** Statuses reachable only through their dedicated action (Complete, Cancel, Archive), never the plain status selector. */
export const LOCKED_EVENT_STATUSES: EventStatus[] = ["completed", "cancelled", "archived"];

/** Statuses selectable from the ordinary status dropdown. */
export const WORKING_EVENT_STATUSES: EventStatus[] = EVENT_STATUSES.filter(
  (status) => !LOCKED_EVENT_STATUSES.includes(status),
);
