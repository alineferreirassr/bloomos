export const VENDOR_STATUSES = ["active", "inactive"] as const;

export type VendorStatus = (typeof VENDOR_STATUSES)[number];

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  active: "Active",
  inactive: "Inactive",
};
