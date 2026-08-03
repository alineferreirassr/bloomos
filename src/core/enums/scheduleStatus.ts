export const SCHEDULE_STATUSES = ["planned", "confirmed", "completed", "delayed", "cancelled"] as const;

export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  planned: "Planned",
  confirmed: "Confirmed",
  completed: "Completed",
  delayed: "Delayed",
  cancelled: "Cancelled",
};
