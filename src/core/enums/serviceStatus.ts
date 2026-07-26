/**
 * A Service's catalog lifecycle — independent of any ServiceVersion's own
 * publish state. "draft" means the catalog entry exists but has never been
 * published (no ServiceVersion yet, so it cannot be assigned to an Event).
 * "active"/"inactive" both have at least one published version; inactive
 * just means staff have paused it from being newly assigned without
 * archiving its history. Mirrors PurchaseStatus's shape (archived is a real
 * member, not a boolean) — see core/workflows/serviceWorkflow.ts.
 */
export const SERVICE_STATUSES = ["draft", "active", "inactive", "archived"] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  draft: "Draft",
  active: "Active",
  inactive: "Inactive",
  archived: "Archived",
};
