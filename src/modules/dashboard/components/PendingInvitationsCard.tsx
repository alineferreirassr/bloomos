"use client";

import { useEffect, useState } from "react";
import { getWorkspaceInvitations } from "@/lib/data";
import { MetricCard } from "@/modules/dashboard/components/MetricCard";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

/**
 * The one genuinely new Dashboard card this phase adds (section 6). Unlike
 * `DashboardMetrics`' existing, already-comprehensive `getDashboardMetrics()`
 * call, this is new code — so it can and does skip the fetch entirely for a
 * member without `team.view`, rather than fetching then hiding.
 */
export function PendingInvitationsCard() {
  const { can } = useMemberSession();
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!can("team.invite")) return;
    let cancelled = false;
    getWorkspaceInvitations({ status: "pending" }).then((invitations) => {
      if (!cancelled) setCount(invitations.length);
    });
    return () => {
      cancelled = true;
    };
  }, [can]);

  // Pending invitations are only reachable by someone with team.invite (the
  // same permission that gates seeing/creating them on the Team page itself)
  // — team.view alone only grants roster visibility, not invitation
  // visibility (see docs/permissions.md's Team foundation RLS section).
  if (!can("team.invite") || count === null) return null;

  return <MetricCard label="Pending Team Invitations" value={String(count)} href="/team" />;
}
