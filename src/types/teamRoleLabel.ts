/**
 * Checkpoint 19, Step 8 — a purely cosmetic job-function label for a Team
 * Dashboard's own role-specific content variant. Deliberately NOT a new
 * access-control role: `WorkspaceMemberRole` (owner/admin/manager/staff,
 * `core/enums/workspaceRole.ts`) and `Permission` remain the only things
 * that ever gate what a member can see or do. A Planner and a Setup Team
 * member with the same `staff` role and the same permissions see the same
 * *data*, filtered the same way — this label only chooses which shape of
 * card composition the Team Dashboard renders around that data (Step 8's
 * own "same foundation, role-aware composition, not a separate design
 * system per role").
 */
export const TEAM_ROLE_LABELS = ["planner", "coordinator", "designer", "setup_team", "finance", "photographer", "general_staff"] as const;

export type TeamRoleLabel = (typeof TEAM_ROLE_LABELS)[number];

export const TEAM_ROLE_LABEL_NAMES: Record<TeamRoleLabel, string> = {
  planner: "Planner",
  coordinator: "Coordinator",
  designer: "Designer",
  setup_team: "Setup Team",
  finance: "Finance",
  photographer: "Photographer",
  general_staff: "General Staff",
};

export const DEFAULT_TEAM_ROLE_LABEL: TeamRoleLabel = "general_staff";
