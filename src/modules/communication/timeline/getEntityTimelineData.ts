"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { registerBuiltinActivitySources } from "@/modules/communication/activityAdapters";
import { aggregateActivity } from "@/core/communication/activityAggregator";
import type { EntityType } from "@/core/enums/entityType";
import type { ActivityEntry, CommunicationCategory } from "@/types/communication";

const GENERIC_ACCESS_ERROR = "This Timeline isn't available. You may not have access to it.";

export interface EntityTimelineFilters {
  categories?: CommunicationCategory[];
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * v2.0 Checkpoint 24, Step 7.5 — the Unified Communication Timeline for one
 * entity. A thin wrapper over `aggregateActivity` with `ownerType`/`ownerId`
 * set — see that function's own doc comment for why this is the same
 * engine as the workspace-wide Activity Feed, not a second one.
 */
export async function getEntityTimelineData(ownerType: EntityType, ownerId: string, filters: EntityTimelineFilters = {}): Promise<{ success: true; data: ActivityEntry[] } | { success: false; error: string }> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };

  registerBuiltinActivitySources();
  const entries = await aggregateActivity({
    workspaceId: session.workspace.id,
    ownerType,
    ownerId,
    categories: filters.categories,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });
  return { success: true, data: entries };
}
