import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { AssignmentStatusBadge } from "@/modules/services/components/AssignmentStatusBadge";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

interface AssignmentSummaryCardProps {
  row: ServiceAssignmentRow;
}

/** Renders entirely from the already-fetched `ServiceAssignmentRow` — no lazy fetch needed, so this appears the instant a row is selected, before `AssignmentTeamCard`/`AssignmentTimelineCard`'s own data arrives. */
export function AssignmentSummaryCard({ row }: AssignmentSummaryCardProps) {
  const { event, client, eventService, versionNumber, completion } = row;
  const percent = completion.total > 0 ? (completion.resolved / completion.total) * 100 : 100;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-serif text-[17px] font-semibold text-text">{event.title}</h3>
        <AssignmentStatusBadge status={eventService.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-text-muted">Client</dt>
          <dd className="text-text">
            {client.first_name} {client.last_name}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Event date</dt>
          <dd className="text-text">{event.event_date ? new Date(event.event_date).toLocaleDateString() : "Not yet scheduled"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assigned version</dt>
          <dd className="text-text">{versionNumber !== null ? `Version ${versionNumber}` : "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Assigned</dt>
          <dd className="text-text">
            {new Date(eventService.assigned_at).toLocaleDateString()} · {eventService.assigned_by}
          </dd>
        </div>
      </dl>
      <div className="mt-3">
        <ProgressBar value={percent} label="Completion" />
      </div>
    </Card>
  );
}
