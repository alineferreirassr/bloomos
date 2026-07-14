export const LEAD_STATUSES = [
  "new",
  "contacted",
  "welcome_guide_sent",
  "consultation_scheduled",
  "qualified",
  "proposal_sent",
  "converted",
  "lost",
  "archived",
] as const;

export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  welcome_guide_sent: "Welcome Guide Sent",
  consultation_scheduled: "Consultation Scheduled",
  qualified: "Qualified",
  proposal_sent: "Proposal Sent",
  converted: "Converted",
  lost: "Lost",
  archived: "Archived",
};

/** Statuses reachable only through their dedicated action (Archive, Convert to Client), never the plain status selector. */
export const LOCKED_LEAD_STATUSES: LeadStatus[] = ["converted", "archived"];

/** Statuses selectable from the ordinary status dropdown. */
export const WORKING_LEAD_STATUSES: LeadStatus[] = LEAD_STATUSES.filter(
  (status) => !LOCKED_LEAD_STATUSES.includes(status),
);
