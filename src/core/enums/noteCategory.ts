export const NOTE_CATEGORIES = [
  "general",
  "special_request",
  "preference",
  "relationship_detail",
  "allergy",
  "accessibility",
  "dietary_restriction",
  "communication",
  "internal_alert",
  "idea",
  "reminder",
  "problem",
] as const;

export type NoteCategory = (typeof NOTE_CATEGORIES)[number];

export const NOTE_CATEGORY_LABELS: Record<NoteCategory, string> = {
  general: "General",
  special_request: "Special Request",
  preference: "Preference",
  relationship_detail: "Relationship Detail",
  allergy: "Allergy",
  accessibility: "Accessibility",
  dietary_restriction: "Dietary Restriction",
  communication: "Communication",
  internal_alert: "Internal Alert",
  idea: "Idea",
  reminder: "Reminder",
  problem: "Problem",
};
