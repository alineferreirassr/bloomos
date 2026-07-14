export const TIMELINE_ACTIVITY_TYPES = [
  "lead_created",
  "lead_updated",
  "status_changed",
  "note_added",
  "note_pinned",
  "note_unpinned",
  "welcome_guide_sent",
  "lead_archived",
  "lead_converted",
] as const;

export type TimelineActivityType = (typeof TIMELINE_ACTIVITY_TYPES)[number];

export const TIMELINE_ACTIVITY_LABELS: Record<TimelineActivityType, string> = {
  lead_created: "Lead created",
  lead_updated: "Lead information updated",
  status_changed: "Status changed",
  note_added: "Note added",
  note_pinned: "Note pinned",
  note_unpinned: "Note unpinned",
  welcome_guide_sent: "Welcome Guide sent",
  lead_archived: "Lead archived",
  lead_converted: "Lead converted to Client",
};
