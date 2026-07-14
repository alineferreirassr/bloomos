export const NOTE_CATEGORIES = [
  "general",
  "special_request",
  "preference",
  "idea",
  "reminder",
  "problem",
  "allergy",
  "internal_alert",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: "General",
  special_request: "Special Request",
  preference: "Preference",
  idea: "Idea",
  reminder: "Reminder",
  problem: "Problem",
  allergy: "Allergy",
  internal_alert: "Internal Alert",
};
