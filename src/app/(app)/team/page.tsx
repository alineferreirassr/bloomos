import { redirect } from "next/navigation";
import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { resolveDashboardExperience } from "@/core/dashboard/resolveDashboardExperience";
import { getLuxuryBranding } from "@/modules/dashboard/luxury/getLuxuryBranding";
import { getTeamPageGlanceData } from "@/modules/team/getTeamPageGlanceData";
import { TeamView } from "@/modules/team/components/TeamView";
import { ErrorState } from "@/components/ui/ErrorState";
import { WORKSPACE_MEMBER_ROLE_LABELS } from "@/core/enums/workspaceRole";

/**
 * "Team page must use the same dashboard system" addendum, then the "Team +
 * Client Compact Clock & Weather Variant" correction — `/team` fetches its
 * own Luxury-shell branding plus a compact single-location Clock+Weather
 * forecast and the same Calendar data every dashboard renders. Unlike
 * `/dashboard/page.tsx`, there's no owner/team branch here: `/team` itself
 * is reached by every role holding `team.view` (see
 * `RouteGuard`/`permissionMatrix.ts`), so `getTeamPageGlanceData` is
 * intentionally role-agnostic.
 */
export default async function TeamPage() {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") redirect("/sign-in");

  const experience = resolveDashboardExperience(session.membership.role);
  const branding = await getLuxuryBranding(experience);
  const glance = await getTeamPageGlanceData();
  if (!glance.success) return <ErrorState message={glance.error} />;

  return (
    <TeamView
      branding={branding}
      profileName={session.profile.full_name ?? session.user.email}
      profileRoleLabel={WORKSPACE_MEMBER_ROLE_LABELS[session.membership.role]}
      profileAvatarUrl={session.profile.avatar_url}
      operationalForecast={glance.data.operationalForecast}
      calendarWidget={glance.data.calendarWidget}
    />
  );
}
