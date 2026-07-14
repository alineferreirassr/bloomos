import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { ScheduleStats } from "@/modules/events/scheduleStats";

const COMPLETION_LABELS: Record<ScheduleStats["completionState"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
};

function itemLabel(item: ScheduleStats["first"]): string {
  if (!item) return "—";
  return item.start_time ? `${item.title} — ${item.start_time}` : item.title;
}

/** Read-only summary only — Schedule CRUD UI is Phase 4. */
export function ScheduleSummaryCard({ stats }: { stats: ScheduleStats }) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Schedule Summary</h3>
      {stats.total === 0 ? (
        <p className="mt-2 text-sm text-text-muted">No schedule items yet.</p>
      ) : (
        <dl className="mt-3 grid grid-cols-1 gap-3">
          <div>
            <dt className="text-xs text-text-muted">Items</dt>
            <dd className="text-sm text-text">{stats.total}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">First</dt>
            <dd className="text-sm text-text">{itemLabel(stats.first)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Last</dt>
            <dd className="text-sm text-text">{itemLabel(stats.last)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Delayed</dt>
            <dd className="text-sm text-text">{stats.delayed}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Status</dt>
            <dd className="text-sm text-text">{COMPLETION_LABELS[stats.completionState]}</dd>
          </div>
        </dl>
      )}
      <Button variant="secondary" className="mt-4" disabled title="Schedule management is coming in Phase 4">
        Manage Schedule
      </Button>
    </Card>
  );
}
