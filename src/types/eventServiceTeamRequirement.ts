/** Generated from ServiceTeamRoleRequirement at assignment time. `assigned_member_id` has no FK yet — same "reserve the nullable reference before both sides are ready" precedent as InventoryItem.primary_vendor_id — populated for real once Team Operations (roadmap Step 5) exists to supply a real Team Member id. */
export interface EventServiceTeamRequirement {
  id: string;
  workspace_id: string;
  event_service_id: string;
  role_label: string;
  quantity: number;
  note: string | null;
  assigned_member_id: string | null;
  created_at: string;
  updated_at: string;
}
