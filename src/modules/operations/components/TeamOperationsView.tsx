"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { KpiCard } from "@/components/ui/KpiCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { getWorkspaceMembers } from "@/lib/data";
import type { TeamMember } from "@/types/teamMember";
import { TeamIcon } from "@/components/ui/icons";
import { getTeamOperationsView, type TeamOperationsView as TeamOperationsData } from "@/modules/operations/teamOperationsData";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState = { status: "loading" } | { status: "ready"; data: TeamOperationsData } | { status: "error" };

type RosterState = { status: "loading" } | { status: "ready"; members: TeamMember[] } | { status: "error" };

/**
 * GLOBAL-VISUAL-02B — the workspace-wide role-count summary (Total Members/
 * Owner/Admin/Manager/Staff) that used to render on `/team` for every
 * `team.view` holder, moved here per founder decision. Gated on
 * `team.manage_roles` — the same permission `TeamView.tsx`'s own Members
 * table already uses to gate role-editing controls on the general Team
 * page — never a new or invented permission. This is a real permission
 * check (`useMemberSession().can(...)`), not a CSS hide: a member without
 * `team.manage_roles` never triggers the `getWorkspaceMembers()` fetch this
 * section needs, and the section itself never mounts for them.
 */
function TeamRosterSummary() {
  const [state, setState] = useState<RosterState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getWorkspaceMembers().then(
      (members) => {
        if (!cancelled) setState({ status: "ready", members });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (state.status === "error") return null;

  const kpis = {
    total: state.members.length,
    owner: state.members.filter((member) => member.role === "owner").length,
    admin: state.members.filter((member) => member.role === "admin").length,
    manager: state.members.filter((member) => member.role === "manager").length,
    staff: state.members.filter((member) => member.role === "staff").length,
  };

  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-accent uppercase">Management</p>
      <h2 className="mt-1 font-serif text-xl font-semibold text-text">Team roster overview</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        <KpiCard icon={TeamIcon} label="Total Members" value={kpis.total.toLocaleString()} tint="var(--color-accent)" />
        <KpiCard icon={TeamIcon} label="Owner" value={kpis.owner.toLocaleString()} tint="var(--color-accent-2)" />
        <KpiCard icon={TeamIcon} label="Admin" value={kpis.admin.toLocaleString()} tint="var(--color-success)" />
        <KpiCard icon={TeamIcon} label="Manager" value={kpis.manager.toLocaleString()} tint="var(--color-warning)" />
        <KpiCard icon={TeamIcon} label="Staff" value={kpis.staff.toLocaleString()} tint="var(--color-danger)" />
      </div>
    </div>
  );
}

/**
 * v2 Checkpoint 21, Step 6 — every team member's own operational view:
 * Today's Events, Assigned Tasks, Navigation Notes, Timeline, and Shift
 * Status, scoped to the signed-in member via the same
 * `Event.assigned_owner === fullName` convention `generateTeamBrief`
 * already established.
 */
export function TeamOperationsView() {
  const session = useMemberSession();
  const canManageRoles = session.can("team.manage_roles");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const fullName = session.status === "active" ? session.profile?.full_name : null;

  const load = () => {
    if (!fullName) return;
    setState({ status: "loading" });
    getTeamOperationsView(fullName).then(
      (data) => setState({ status: "ready", data }),
      () => setState({ status: "error" }),
    );
  };

  useEffect(() => {
    if (!fullName) return;
    let cancelled = false;
    getTeamOperationsView(fullName).then(
      (data) => {
        if (!cancelled) setState({ status: "ready", data });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [fullName]);

  if (!fullName) {
    return <EmptyState title="No name on file" description="Add your full name in Account settings to see your Team Operations view." />;
  }

  if (state.status === "loading") {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (state.status === "error") {
    return <ErrorState message="Could not load your Team Operations view." onRetry={load} />;
  }

  const { data } = state;

  return (
    <div className="space-y-6">
      <PageHeader title="Team Operations" subtitle={`Your own operational view, ${fullName}.`} />

      {canManageRoles ? <TeamRosterSummary /> : null}

      <Card>
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-[17px] font-semibold text-text">Shift Status</h3>
          <Badge tone={data.isCheckedIn ? "success" : "outline"}>{data.isCheckedIn ? "Checked in" : "Not checked in"}</Badge>
        </div>
        {data.lastCheckInAt ? <p className="mt-1 text-xs text-text-muted">Last update {new Date(data.lastCheckInAt).toLocaleString()}</p> : null}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Today&apos;s Events</h3>
        {data.todaysEvents.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">Nothing assigned to you today.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.todaysEvents.map((event) => (
              <li key={event.id}>
                <Link href={`/events/${event.id}`} className="block rounded-md border border-border p-2.5 text-sm hover:border-accent/50">
                  <p className="text-text">{event.title}</p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    {event.start_time ?? "—"} · {event.location_name ?? event.address ?? "No location on file"}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Assigned Tasks</h3>
        {data.assignedTasks.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No open tasks assigned to you.</p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {data.assignedTasks.map((task) => (
              <li key={task.id} className="flex items-center justify-between text-sm">
                <span className="text-text">{task.title}</span>
                <span className="text-xs text-text-muted">{task.due_date ?? "No due date"}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[17px] font-semibold text-text">Timeline (today&apos;s events)</h3>
        {data.timeline.length === 0 ? <p className="mt-2 text-sm text-text-muted">No activity recorded yet today.</p> : <Timeline activities={data.timeline} />}
      </Card>

      <Card>
        <p className="text-xs text-text-muted">
          Inventory assignments and internal team messaging aren&apos;t modeled in BloomOS yet — this view shows only what&apos;s real: your assigned events, tasks, and shift status.
        </p>
      </Card>
    </div>
  );
}
