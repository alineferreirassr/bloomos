"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Timeline } from "@/modules/timeline/components/Timeline";
import { getTeamOperationsView, type TeamOperationsView as TeamOperationsData } from "@/modules/operations/teamOperationsData";
import { useMemberSession } from "@/components/providers/MemberSessionProvider";

type LoadState = { status: "loading" } | { status: "ready"; data: TeamOperationsData } | { status: "error" };

/**
 * v2 Checkpoint 21, Step 6 — every team member's own operational view:
 * Today's Events, Assigned Tasks, Navigation Notes, Timeline, and Shift
 * Status, scoped to the signed-in member via the same
 * `Event.assigned_owner === fullName` convention `generateTeamBrief`
 * already established.
 */
export function TeamOperationsView() {
  const session = useMemberSession();
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
