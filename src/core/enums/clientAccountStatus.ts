/**
 * The Client Portal account lifecycle — deliberately separate from
 * `WorkspaceMemberStatus` (owner/admin/manager/staff), since a client
 * account never grants internal Workspace membership. `invited` is
 * reserved/unused, the same precedent as `WorkspaceMemberStatus`'s own
 * `invited` value: `client_accounts` rows are created directly with
 * `status: 'active'` at acceptance time, never as an intermediate
 * `invited` row — see docs/permissions.md.
 */
export const CLIENT_ACCOUNT_STATUSES = ["invited", "active", "suspended", "revoked"] as const;

export type ClientAccountStatus = (typeof CLIENT_ACCOUNT_STATUSES)[number];

export const CLIENT_ACCOUNT_STATUS_LABELS: Record<ClientAccountStatus, string> = {
  invited: "Invited",
  active: "Active",
  suspended: "Suspended",
  revoked: "Revoked",
};
