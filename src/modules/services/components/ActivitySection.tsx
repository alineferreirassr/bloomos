import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTimelineActivityLabel } from "@/core/timeline/activityTypeRegistry";
import type { TimelineActivity } from "@/types/timelineActivity";

interface ActivitySectionProps {
  activities: TimelineActivity[];
  /** How many of the most recent activities to show — the condensed glance this section is for, distinct from the full history in the Timeline tab. */
  limit?: number;
}

/**
 * The condensed "what just happened" glance (Assignment created, status
 * changes, overrides, notes, attachments — whatever the shared Timeline
 * already records against this EventService) — the full, unbounded history
 * lives in its own Timeline tab via the already-existing `AssignmentTimelineCard`.
 * Reuses the exact same `TimelineActivity[]` the Workspace already fetched;
 * no separate query.
 */
export function ActivitySection({ activities, limit = 5 }: ActivitySectionProps) {
  const recent = [...activities].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);

  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Recent activity</h3>
      {recent.length === 0 ? (
        <div className="mt-2">
          <EmptyState title="No activity yet" description="Changes to this assignment will show up here." />
        </div>
      ) : (
        <ul className="mt-3 space-y-2 text-sm">
          {recent.map((activity) => (
            <li key={activity.id} className="border-b border-border/60 pb-2 last:border-0 last:pb-0">
              <p className="font-medium text-text">{getTimelineActivityLabel(activity.type)}</p>
              <p className="text-xs text-text-muted">
                {activity.actor} · {new Date(activity.timestamp).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
