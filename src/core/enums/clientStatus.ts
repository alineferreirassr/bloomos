export const CLIENT_STATUSES = ["active", "planning", "past_client", "inactive", "archived"] as const;

export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: "Active",
  planning: "Planning",
  past_client: "Past Client",
  inactive: "Inactive",
  archived: "Archived",
};
