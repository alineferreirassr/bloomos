import Link from "next/link";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { useEventServiceWorkspace } from "@/modules/services/hooks/useEventServiceWorkspace";
import { AssignmentSummaryCard } from "@/modules/services/components/AssignmentSummaryCard";
import { AssignmentOverridesCard } from "@/modules/services/components/AssignmentOverridesCard";
import { AssignmentTeamCard } from "@/modules/services/components/AssignmentTeamCard";
import { AssignmentTimelineCard } from "@/modules/services/components/AssignmentTimelineCard";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

interface AssignmentDetailPanelProps {
  row: ServiceAssignmentRow;
  serviceId: string;
}

/**
 * Read-only end to end except for `AssignmentOverridesCard`'s existing,
 * reused override mutation. `AssignmentSummaryCard`/`AssignmentOverridesCard`
 * render immediately from `row` (already fetched by the page); only
 * `AssignmentTeamCard`/`AssignmentTimelineCard` — which need the full
 * per-requirement team list and the unbounded activity timeline, neither of
 * which the list row carries — wait on a lazy `useEventServiceWorkspace`
 * call scoped to whichever single assignment is selected. No "Health
 * snapshot": `getServiceHealth` is hard-scoped to a Service's current draft
 * version and has no concept of an arbitrary EventService's pinned version,
 * so a genuine assignment-scoped health value doesn't exist anywhere in the
 * domain — `Completion` (above, in the summary card) is the one real
 * per-assignment signal that does.
 */
export function AssignmentDetailPanel({ row, serviceId }: AssignmentDetailPanelProps) {
  const workspace = useEventServiceWorkspace(row.eventService.id);

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="sr-only">
        Viewing {row.event.title}.
      </p>
      <div className="flex justify-end">
        <Link href={`/services/${serviceId}/assignments/${row.eventService.id}`}>
          <Button type="button" variant="primary">
            Open Workspace
          </Button>
        </Link>
      </div>
      <AssignmentSummaryCard row={row} />
      <AssignmentOverridesCard eventService={row.eventService} serviceId={serviceId} />

      {workspace.status === "pending" ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : null}
      {workspace.status === "error" ? <ErrorState message="We couldn't load this assignment's team and timeline." onRetry={() => workspace.refetch()} /> : null}
      {workspace.status === "success" ? (
        <>
          <AssignmentTeamCard team={workspace.data.requirements.team} />
          <AssignmentTimelineCard activities={workspace.data.timeline} />
        </>
      ) : null}
    </div>
  );
}
