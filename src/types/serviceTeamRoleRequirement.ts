/** A staffing role a Service typically needs (e.g. "Lead Photographer" × 1). Generates an EventServiceTeamRequirement on assignment with no real person assigned yet — `assigned_member_id` only becomes possible once Team Operations (roadmap Step 5) ships a real Team Member id to point at. */
export interface ServiceTeamRoleRequirement {
  id: string;
  workspace_id: string;
  service_version_id: string;
  role_label: string;
  quantity: number;
  note: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
