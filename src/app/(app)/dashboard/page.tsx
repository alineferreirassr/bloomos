import { redirect } from "next/navigation";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { getOwnerDashboardData } from "@/modules/dashboard/luxury/getOwnerDashboardData";
import { getTeamDashboardData } from "@/modules/dashboard/luxury/getTeamDashboardData";
import { getLuxuryBranding } from "@/modules/dashboard/luxury/getLuxuryBranding";
import { OwnerDashboardView } from "@/modules/dashboard/luxury/components/OwnerDashboardView";
import { TeamDashboardView } from "@/modules/dashboard/luxury/components/TeamDashboardView";
import { ErrorState } from "@/components/ui/ErrorState";
import { WORKSPACE_MEMBER_ROLE_LABELS } from "@/core/enums/workspaceRole";

/**
 * Checkpoint 19, Step 4 — `/dashboard` itself is the Dashboard Experience
 * Resolver's own call site: resolve the signed-in member's real role
 * server-side, then render the Owner or Team Luxury Dashboard accordingly.
 * Both `get*DashboardData` aggregators independently re-verify the same
 * role gate (Step 17) — this branch is a routing convenience, not the
 * security boundary.
 */
export default async function DashboardPage() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") redirect("/sign-in");

  const experience = resolveDashboardExperience(session.membership.role);
  const branding = await getLuxuryBranding(experience);
  const profileName = session.profile.full_name ?? session.user.email;
  const profileRoleLabel = WORKSPACE_MEMBER_ROLE_LABELS[session.membership.role];

  if (experience === "owner") {
    const result = await getOwnerDashboardData();
    if (!result.success) return <ErrorState message={result.error} />;
    return <OwnerDashboardView data={result.data} branding={branding} profileName={profileName} profileRoleLabel={profileRoleLabel} profileAvatarUrl={session.profile.avatar_url} />;
  }

  const result = await getTeamDashboardData();
  if (!result.success) return <ErrorState message={result.error} />;
  return <TeamDashboardView data={result.data} branding={branding} profileName={profileName} profileRoleLabel={profileRoleLabel} profileAvatarUrl={session.profile.avatar_url} />;
}
