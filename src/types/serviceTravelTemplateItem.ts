/** A travel/logistics requirement a Service typically carries — a forward-looking hook for the future Team Travel Mode roadmap step, not consumed by anything yet. */
export interface ServiceTravelTemplateItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  label: string;
  description: string | null;
  requires_equipment_transport: boolean;
  drive_time_buffer_minutes: number | null;
  mileage_estimate: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
