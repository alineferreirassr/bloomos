/** A named approval checkpoint a Service typically needs before its Event date (e.g. "Client approves floor plan"). `days_before_event_deadline` is resolved against the Event's own date when generating the EventService's own approval-tracking rows; `required_role` is a free-text label (no Team Operations role model exists yet to reference). */
export interface ServiceApprovalTemplateItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  label: string;
  description: string | null;
  days_before_event_deadline: number | null;
  required_role: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
