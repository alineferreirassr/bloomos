import type { EventServiceVendorAssignmentStatus } from "@/core/enums/eventServiceVendorAssignmentStatus";

/** Generated from ServiceVendorSuggestion at assignment time as "suggested"; a human confirms one (or declines it) for this specific booking — the Service's suggestion never changes as a result. */
export interface EventServiceVendorAssignment {
  id: string;
  workspace_id: string;
  event_service_id: string;
  vendor_id: string;
  status: EventServiceVendorAssignmentStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
}
