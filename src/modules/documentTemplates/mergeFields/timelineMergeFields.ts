import { registerMergeField } from "@/core/documents/mergeFieldRegistry";
import { registerMergeResolver } from "@/core/documents/mergeEngine";
import { getCoreTimelineService } from "@/core/timeline";
import type { MergeFieldDefinition } from "@/types/documentPlatform";
import type { TimelineActivity } from "@/types/timelineActivity";

function mostRecent(activities: TimelineActivity[]): TimelineActivity | null {
  if (activities.length === 0) return null;
  return activities.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
}

/**
 * The `"timeline"` Merge Field domain (v2 Checkpoint 44) — the most
 * recent real Timeline activity recorded for the linked Client, via the
 * same `getCoreTimelineService().getTimelineForOwner()` every other
 * checkpoint's own Timeline integration already calls — never a second
 * timeline read model.
 */
export const timelineMergeFieldDefinitions: MergeFieldDefinition[] = [
  { key: "latest_activity_description", label: "Latest Activity", description: "The description of the most recent Timeline activity recorded for the linked Client.", domain: "timeline", valueType: "string", required: false },
  { key: "latest_activity_date", label: "Latest Activity Date", description: "The date of the most recent Timeline activity recorded for the linked Client.", domain: "timeline", valueType: "date", required: false },
];

export function registerTimelineMergeFields(): void {
  for (const definition of timelineMergeFieldDefinitions) registerMergeField(definition);

  registerMergeResolver("latest_activity_description", async (context) => {
    if (!context.clientId) return null;
    const activities = await getCoreTimelineService().getTimelineForOwner(context.workspaceId, "client", context.clientId).catch(() => []);
    return mostRecent(activities)?.description ?? null;
  });

  registerMergeResolver("latest_activity_date", async (context) => {
    if (!context.clientId) return null;
    const activities = await getCoreTimelineService().getTimelineForOwner(context.workspaceId, "client", context.clientId).catch(() => []);
    return mostRecent(activities)?.timestamp ?? null;
  });
}
