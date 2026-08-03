"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getWorkspaceMemberById, getWorkspaceMembers } from "@/lib/data";
import { getTeamRoleLabel, setTeamRoleLabel } from "@/lib/data/core/dashboard/teamRoleLabelStore";
import type { TeamRoleLabel } from "@/types/teamRoleLabel";

const GENERIC_ACCESS_ERROR = "Team role labels aren't available. You may not have access to them.";

export type TeamRoleLabelResult<T> = { success: true; data: T } | { success: false; error: string };

/** Checkpoint 19, Step 8 — lets `team.manage_roles` set the cosmetic Team Dashboard variant a member sees, from the existing Team management surface. Never touches `WorkspaceMemberRole`/`Permission`. */
export async function setTeamRoleLabelAction(memberId: string, label: TeamRoleLabel): Promise<TeamRoleLabelResult<TeamRoleLabel>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("team.manage_roles")) return { success: false, error: GENERIC_ACCESS_ERROR };

  try {
    const member = await getWorkspaceMemberById(memberId);
    if (member.workspace_id !== session.workspace.id) return { success: false, error: GENERIC_ACCESS_ERROR };
  } catch {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  setTeamRoleLabel(memberId, label);
  return { success: true, data: label };
}

/** Read-only lookup for the current member's own label — used by the Team Dashboard aggregator and the Team management UI alike, so both always agree. */
export async function getOwnTeamRoleLabelAction(): Promise<TeamRoleLabelResult<TeamRoleLabel>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  return { success: true, data: getTeamRoleLabel(session.membership.id) };
}

/** Every workspace member's own label, keyed by member id — backs the Team page's own picker so it never issues one fetch per row. */
export async function listTeamRoleLabelsAction(): Promise<TeamRoleLabelResult<Record<string, TeamRoleLabel>>> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("team.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const members = await getWorkspaceMembers();
  const result: Record<string, TeamRoleLabel> = {};
  for (const member of members) result[member.id] = getTeamRoleLabel(member.id);
  return { success: true, data: result };
}
