/** An optional paid extra a client can add to a Service booking — price_delta_minor is added to the EventService's price snapshot only if the add-on is actually selected at assignment time (see EventService in types/eventService.ts). */
export interface ServiceAddOn {
  id: string;
  workspace_id: string;
  service_version_id: string;
  label: string;
  description: string | null;
  price_delta_minor: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}
