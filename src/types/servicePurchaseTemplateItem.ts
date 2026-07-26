/** What's typically purchased for a Service — a draft a human reviews and turns into a real Purchase through the existing New Purchase flow; never creates a real Purchase automatically. `typical_vendor_id` is an optional, non-binding suggestion. */
export interface ServicePurchaseTemplateItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  item_name: string;
  estimated_unit_cost_minor: number;
  estimated_quantity: number;
  typical_vendor_id: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
