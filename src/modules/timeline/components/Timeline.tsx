import { TIMELINE_ACTIVITY_LABELS } from "@/core/enums/timelineActivityType";
import type { TimelineActivity } from "@/types/timelineActivity";
import { EmptyState } from "@/components/ui/EmptyState";

/** Generic — renders any owner's TimelineActivity[] (Lead or Client), no owner-specific logic. */
export function Timeline({ activities }: { activities: TimelineActivity[] }) {
  if (activities.length === 0) {
    return <EmptyState title="No activity yet" />;
  }

  return (
    <ol className="space-y-4 border-l border-border pl-4">
      {activities.map((activity) => (
        <li key={activity.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent" />
          <p className="text-sm font-medium text-text">
            {TIMELINE_ACTIVITY_LABELS[activity.type]}
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
