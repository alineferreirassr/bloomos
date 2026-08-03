import { Card } from "@/components/ui/Card";
import { Timeline } from "@/modules/timeline/components/Timeline";
import type { TimelineActivity } from "@/types/timelineActivity";

interface AssignmentTimelineCardProps {
  activities: TimelineActivity[];
}

/** Unlike Version History's timeline (which had to be hand-built — a ServiceVersion isn't a `TimelineActivity`), `getEventServiceWorkspace` already returns genuine `TimelineActivity[]` scoped to this exact EventService, so the shared `Timeline` component is directly reusable here. */
export function AssignmentTimelineCard({ activities }: AssignmentTimelineCardProps) {
  return (
    <Card>
      <h3 className="font-serif text-[17px] font-semibold text-text">Timeline</h3>
      <div className="mt-3">
        <Timeline activities={activities} emptyTitle="No activity yet" emptyDescription="Changes to this assignment will show up here." />
      </div>
    </Card>
  );
}
