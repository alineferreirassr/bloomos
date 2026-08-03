export const EVENT_PRIORITIES = ["low", "normal", "high", "urgent", "critical"] as const;

export type EventPriority = (typeof EVENT_PRIORITIES)[number];

export const EVENT_PRIORITY_LABELS: Record<EventPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
  critical: "Critical",
};
