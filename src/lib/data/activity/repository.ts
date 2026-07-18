import type { TimelineActivity } from "@/types/timelineActivity";

/**
 * A single, workspace-wide "recent activity" read — spans every module
 * (Leads/Clients/Events/Contracts/Finance/Documents), so it lives in its own
 * directory rather than under any one of them, the same rationale as
 * lib/data/conversion/. Every module already writes to the one shared
 * `timeline_activities` table via `recordTimelineActivity`/the Supabase
 * insert calls inside each module's own repository — this repository adds
 * no new writes, only a workspace-wide read across all of them, for the
 * Booking Dashboard's "Recent Activity" card (Booking Workflow, Phase 2).
 */
export interface ActivityRepository {
  getRecentActivity(limit?: number): Promise<TimelineActivity[]>;
}
