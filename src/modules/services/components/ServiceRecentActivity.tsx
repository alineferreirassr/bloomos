import { Card } from "@/components/ui/Card";
import { Timeline } from "@/modules/timeline/components/Timeline";
import type { TimelineActivity } from "@/types/timelineActivity";

interface ServiceRecentActivityProps {
  activities: TimelineActivity[];
}

/**
 * Renders the bounded slice `useServiceEditor` already fetched
 * (`getServiceEditor`'s `RECENT_TIMELINE_LIMIT`, currently 10) — never fetches
 * on its own, and never claims to be the full history. The Timeline TAB
 * (full, unbounded activity) has its own feature hook to build later; this
 * is Overview's "recent activity" section only.
 */
export function ServiceRecentActivity({ activities }: ServiceRecentActivityProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Recent activity</h3>
      <div className="mt-3">
        <Timeline activities={activities} emptyTitle="No activity yet" emptyDescription="Changes to this Service will show up here." />
      </div>
    </Card>
  );
}
