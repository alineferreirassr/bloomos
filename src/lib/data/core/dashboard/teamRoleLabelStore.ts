import { DEFAULT_TEAM_ROLE_LABEL, type TeamRoleLabel } from "@/types/teamRoleLabel";

/**
 * Checkpoint 19 — the Team Role Label store. Mock-only, unconditionally,
 * regardless of `NEXT_PUBLIC_DATA_MODE` — the same "new checkpoint domain,
 * mock-only this phase" precedent every domain since Checkpoint 13 has
 * followed. `TeamMember` itself (`lib/data/team/mockRepository.ts`) stays
 * dual-mode and untouched — this is a small, independent side-table keyed
 * by `member_id`, never a column added to the real `workspace_members`
 * table. A production deployment would add a real `team_role_label` column
 * via migration; see docs/team-dashboard.md's Known limitations.
 *
 * A plain `let` (not `getGlobalMockStore`) — every access is from a Server
 * Action or a dashboard data aggregator, never a Route Handler.
 */
let labels = new Map<string, TeamRoleLabel>();

export function resetTeamRoleLabelStore(): void {
  labels = new Map();
}

export function getTeamRoleLabel(memberId: string): TeamRoleLabel {
  return labels.get(memberId) ?? DEFAULT_TEAM_ROLE_LABEL;
}

export function setTeamRoleLabel(memberId: string, label: TeamRoleLabel): void {
  labels.set(memberId, label);
}
