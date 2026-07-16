export const WORKSPACE_MEMBER_STATUSES = ["active", "invited", "suspended"] as const;

export type WorkspaceMemberStatus = (typeof WORKSPACE_MEMBER_STATUSES)[number];

export const WORKSPACE_MEMBER_STATUS_LABELS: Record<WorkspaceMemberStatus, string> = {
  active: "Active",
  invited: "Invited",
  suspended: "Suspended",
};
