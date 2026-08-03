/** Every EventServiceVendorAssignment starts "suggested" (copied from a ServiceVendorSuggestion at assignment time) — a human then confirms one or declines it. Never auto-confirmed. */
export type EventServiceVendorAssignmentStatus = "suggested" | "confirmed" | "declined";
