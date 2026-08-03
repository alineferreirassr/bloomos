import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { isUpcomingAssignment, DEFAULT_ASSIGNMENT_FILTERS, type AssignmentFiltersValue } from "@/modules/services/assignmentFiltering";
import type { ServiceAssignmentRow } from "@/lib/queries/services/types";

interface AssignmentSidebarProps {
  /** Always the full, unfiltered set — sidebar totals summarize every assignment this Service has, not just what the current filters happen to show. */
  rows: ServiceAssignmentRow[];
  onFiltersChange: (filters: AssignmentFiltersValue) => void;
  now: Date;
}

function versionUsage(rows: ServiceAssignmentRow[]): Array<{ versionNumber: number | null; count: number }> {
  const counts = new Map<number | null, number>();
  for (const row of rows) {
    counts.set(row.versionNumber, (counts.get(row.versionNumber) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([versionNumber, count]) => ({ versionNumber, count }))
    .sort((a, b) => (b.versionNumber ?? -1) - (a.versionNumber ?? -1));
}

/** "Active" mirrors `canOverrideEventService`'s own non-terminal set (proposed/confirmed/in_progress) — an assignment still open to change, as opposed to `completed`/`cancelled` — but is reported separately from Completed here since only Cancelled is called out by name in this sidebar. */
function isActiveAssignment(status: ServiceAssignmentRow["eventService"]["status"]): boolean {
  return status === "proposed" || status === "confirmed" || status === "in_progress";
}

export function AssignmentSidebar({ rows, onFiltersChange, now }: AssignmentSidebarProps) {
  const upcomingCount = rows.filter((row) => isUpcomingAssignment(row.event.event_date, now)).length;
  const pastCount = rows.length - upcomingCount;

  const activeAssignmentCount = rows.filter((row) => isActiveAssignment(row.eventService.status)).length;
  const cancelledAssignmentCount = rows.filter((row) => row.eventService.status === "cancelled").length;

  return (
    <div className="space-y-4">
      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Timing</h3>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Upcoming assignments</dt>
            <dd className="text-text">{upcomingCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Past assignments</dt>
            <dd className="text-text">{pastCount}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Assignments</h3>
        <dl className="mt-2 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Active assignments</dt>
            <dd className="text-text">{activeAssignmentCount}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-text-muted">Cancelled assignments</dt>
            <dd className="text-text">{cancelledAssignmentCount}</dd>
          </div>
        </dl>
      </Card>

      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Version usage</h3>
        {rows.length === 0 ? (
          <p className="mt-2 text-sm text-text-muted">No assignments yet.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-sm">
            {versionUsage(rows).map(({ versionNumber, count }) => (
              <li key={versionNumber ?? "unknown"} className="flex items-center justify-between">
                <span className="text-text-muted">{versionNumber !== null ? `Version ${versionNumber}` : "Unknown version"}</span>
                <span className="text-text">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <h3 className="font-serif text-[15px] font-semibold text-text">Quick filters</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={() => onFiltersChange(DEFAULT_ASSIGNMENT_FILTERS)}>
            All
          </Button>
          <Button type="button" variant="secondary" onClick={() => onFiltersChange({ ...DEFAULT_ASSIGNMENT_FILTERS, timing: "upcoming" })}>
            Upcoming
          </Button>
          <Button type="button" variant="secondary" onClick={() => onFiltersChange({ ...DEFAULT_ASSIGNMENT_FILTERS, timing: "past" })}>
            Past
          </Button>
          <Button type="button" variant="secondary" onClick={() => onFiltersChange({ ...DEFAULT_ASSIGNMENT_FILTERS, status: "cancelled" })}>
            Cancelled
          </Button>
          <Button type="button" variant="secondary" onClick={() => onFiltersChange({ ...DEFAULT_ASSIGNMENT_FILTERS, status: "completed" })}>
            Completed
          </Button>
        </div>
      </Card>
    </div>
  );
}
