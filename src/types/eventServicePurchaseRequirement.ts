/** Generated from ServicePurchaseTemplateItem at assignment time — a draft a human reviews and turns into a real Purchase through the existing New Purchase flow. `fulfilled_purchase_id` is set once that happens (the FULFILLS edge in the Operational Graph); never creates a real Purchase automatically. */
export interface EventServicePurchaseRequirement {
  id: string;
  workspace_id: string;
  event_service_id: string;
  item_name: string;
  estimated_unit_cost_minor: number;
  estimated_quantity: number;
  typical_vendor_id: string | null;
  fulfilled_purchase_id: string | null;
  created_at: string;
  updated_at: string;
}
