import type { TimelineActivity } from "@/types/timelineActivity";
import { UnauthorizedError, ForbiddenError } from "@/core/errors";
import { createClient } from "@/lib/supabase/client";
import { normalizeSupabaseError } from "@/lib/supabase/errors";
import { mapTimelineActivityRow } from "@/lib/supabase/mappers";
import { getClientWorkspaceSession, type WorkspaceSession } from "@/lib/auth/workspaceSessionClient";
import type { ActivityRepository } from "@/lib/data/activity/repository";

/** Same rationale as every other Supabase repository's requireWorkspaceSession. */
async function requireWorkspaceSession(): Promise<WorkspaceSession> {
  const result = await getClientWorkspaceSession();
  if (result.status === "unauthenticated") {
    throw new UnauthorizedError("Authentication is required.");
  }
  if (result.status === "no-workspace") {
    throw new ForbiddenError("You don't have permission to do that.");
  }
  return result.session;
}

/**
 * A single workspace-wide read across `timeline_activities` — no owner_type
 * filter, unlike every other timeline query in this codebase (each of which
 * scopes to one owner_type/owner_id at a time). RLS (is_workspace_member,
 * unchanged) still fully governs which rows come back; this is purely a
 * different query shape over the same already-live, already-protected table.
 */
async function getRecentActivity(limit = 20): Promise<TimelineActivity[]> {
  const session = await requireWorkspaceSession();
  const supabase = createClient();

  const { data, error } = await supabase
    .from("timeline_activities")
    .select("*")
    .eq("workspace_id", session.workspace.id)
    .order("timestamp", { ascending: false })
    .limit(limit);
  if (error) throw normalizeSupabaseError(error);

  return (data ?? []).map(mapTimelineActivityRow);
}

export const supabaseActivityRepository: ActivityRepository = {
  getRecentActivity,
};
