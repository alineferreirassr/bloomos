/** A document TYPE a Service typically requires (e.g. "Signed liability waiver") — not a real Document row, just a reusable requirement label. Fulfillment against a real Document (once Documents supports linking) is a future extension, not built here. */
export interface ServiceRequiredDocument {
  id: string;
  workspace_id: string;
  service_version_id: string;
  label: string;
  category: string | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}
