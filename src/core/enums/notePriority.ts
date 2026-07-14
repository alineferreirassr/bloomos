export const NOTE_PRIORITIES = ["low", "normal", "high", "critical"] as const;

export type NotePriority = (typeof NOTE_PRIORITIES)[number];

export const NOTE_PRIORITY_LABELS: Record<NotePriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  critical: "Critical",
};
