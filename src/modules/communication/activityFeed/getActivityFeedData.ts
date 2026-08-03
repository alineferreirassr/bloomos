"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinActivitySources } from "@/modules/communication/activityAdapters";
import { aggregateActivity } from "@/core/communication/activityAggregator";
import type { ActivityEntry, CommunicationCategory } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "The Activity Feed isn't available. You may not have access to it.";

export interface ActivityFeedFilters {
  categories?: CommunicationCategory[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  actorMemberId?: string;
}

/** v2.0 Checkpoint 24, Step 7 — the workspace-wide Activity Feed. Same engine as the per-entity Timeline (`getEntityTimelineData.ts`), called with no `ownerType`/`ownerId` — see `aggregateActivity`'s own doc comment. */
export async function getActivityFeedData(filters: ActivityFeedFilters = {}): Promise<{ success: true; data: ActivityEntry[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active" || !session.permissions.includes("communications.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  registerBuiltinActivitySources();
  const entries = await aggregateActivity({ workspaceId: session.workspace.id, ...filters });
  return { success: true, data: entries };
}
