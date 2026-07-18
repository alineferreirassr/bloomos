import type { TimelineActivity } from "@/types/timelineActivity";
import { CURRENT_WORKSPACE_ID } from "@/core/constants/workspace";
import { readActivities } from "@/lib/data/mock/timelineStore";
import type { ActivityRepository } from "@/lib/data/activity/repository";

async function getRecentActivity(limit = 20): Promise<TimelineActivity[]> {
  return [...readActivities()]
    .filter((activity) => activity.workspace_id === CURRENT_WORKSPACE_ID)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, limit);
}

export const mockActivityRepository: ActivityRepository = {
  getRecentActivity,
};
