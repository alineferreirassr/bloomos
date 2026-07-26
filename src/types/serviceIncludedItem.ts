/** Something included by default with a Service, at no extra price — display-only content for the catalog/proposal view, not something that generates any Event-side row on assignment. */
export interface ServiceIncludedItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  label: string;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
