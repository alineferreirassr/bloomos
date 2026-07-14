/**
 * Who/what a ChecklistItem is assigned to. No Employee or Vendor module
 * exists yet — this only prepares the shape so checklist assignment doesn't
 * need a schema change once Team Management and Vendors are built.
 * assigned_id stays null until those modules exist to supply a real id;
 * assigned_name carries a free-text display name in the meantime.
 */
export const ASSIGNED_TYPES = ["employee", "vendor", "client", "unknown"] as const;

export type AssignedType = (typeof ASSIGNED_TYPES)[number];

export const ASSIGNED_TYPE_LABELS: Record<AssignedType, string> = {
  employee: "Employee",
  vendor: "Vendor",
  client: "Client",
  unknown: "Unassigned",
};
