/** A recommended real Vendor for this Service — generates an unconfirmed EventServiceVendorAssignment on assignment (types/eventServiceVendorAssignment.ts); a human still confirms which, if any, suggestion is actually used for a given booking. */
export interface ServiceVendorSuggestion {
  id: string;
  workspace_id: string;
  service_version_id: string;
  vendor_id: string;
  note: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
