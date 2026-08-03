import { getTimelineActivityLabel } from "@/core/timeline/activityTypeRegistry";
import type { TimelineActivity } from "@/types/timelineActivity";
import { EmptyState } from "@/components/ui/EmptyState";

interface TimelineProps {
  activities: TimelineActivity[];
  emptyTitle?: string;
  emptyDescription?: string;
}

/**
 * Generic — renders any owner's TimelineActivity[], no owner-specific logic.
 *
 * Labels resolve through `getTimelineActivityLabel` (Core's activity-type
 * registry), not the closed `TIMELINE_ACTIVITY_LABELS` map directly — the
 * registry is seeded from that same map at load time, so every existing
 * caller's output is unchanged, but it also correctly resolves activity
 * types a module registers dynamically (e.g. Vendor's `vendor_created`),
 * which aren't in the closed map and would otherwise render as `undefined`.
 * Falls back to the raw type string for anything unregistered, matching
 * `getTimelineActivityLabel`'s own documented behavior.
 */
export function Timeline({ activities, emptyTitle = "No activity yet", emptyDescription }: TimelineProps) {
  if (activities.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {activities.map((activity, index) => (
        <li
          key={activity.id}
          className={`animate-timeline-reveal stagger-${Math.min(index, 6)} relative`}
        >
          <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent ring-4 ring-surface" />
          <p className="text-sm font-medium text-text">
            {getTimelineActivityLabel(activity.type)}
          </p>
          <p className="text-sm text-text-muted">{activity.description}</p>
          <p className="mt-0.5 text-xs text-text-muted">
            {activity.actor} · {new Date(activity.timestamp).toLocaleString()}
          </p>
        </li>
      ))}
    </ol>
  );
}
