export const CHECKLIST_STATUSES = ["pending", "in_progress", "blocked", "completed", "cancelled"] as const;

export type ChecklistStatus = (typeof CHECKLIST_STATUSES)[number];

export const CHECKLIST_STATUS_LABELS: Record<ChecklistStatus, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};
