import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import type { EntityType } from "@/core/enums/entityType";
import type { TimelineActivity } from "@/types/timelineActivity";
import { getDataMode } from "@/lib/data/provider";
import { getTimelineByOwner } from "@/lib/data/mock/notesTimelineShared";
import { recordTimelineActivity } from "@/lib/data/mock/timelineStore";
import { fetchTimelineForOwnerSupabase, recordTimelineActivitySupabase } from "@/lib/data/core/notesTimelineSupabaseShared";
import type { CoreTimelineActivityType } from "@/core/timeline/activityTypeRegistry";

export type { TimelineActivity } from "@/types/timelineActivity";
export * from "@/core/timeline/activityTypeRegistry";
export { registerDefaultTimelineActivityTypes } from "@/core/timeline/defaultActivityTypeRegistrations";

/**
 * Core's canonical Timeline front door, mirroring `core/notes`'s shape.
 * `type` accepts `CoreTimelineActivityType` (a known label or any
 * registered/unregistered string) rather than the closed
 * `TimelineActivityType` union every existing module's call sites use —
 * see `activityTypeRegistry.ts` for why. Existing modules are not migrated
 * onto this in this phase.
 */
export interface CoreTimelineService {
  getTimelineForOwner(workspaceId: string, ownerType: EntityType, ownerId: string): Promise<TimelineActivity[]>;
  /**
   * `actor` is ignored in mock mode — the shared mock helper always
   * attributes to `CURRENT_ACTOR` (no auth exists in mock mode to attribute
   * to anyone else), but a real Supabase-mode caller has a real signed-in
   * actor name to pass, so the interface always takes one explicitly.
   */
  recordActivity(
    workspaceId: string,
    ownerType: EntityType,
    ownerId: string,
    actor: string,
    type: CoreTimelineActivityType,
    description: string,
    metadata?: Record<string, string | number | boolean | null>,
  ): Promise<void>;
}

function mockCoreTimelineService(): CoreTimelineService {
  return {
    getTimelineForOwner: (workspaceId, ownerType, ownerId) => getTimelineByOwner(workspaceId, ownerType, ownerId),
    recordActivity: async (workspaceId, ownerType, ownerId, _actor, type, description, metadata) => {
      recordTimelineActivity(workspaceId, ownerType, ownerId, type as TimelineActivity["type"], description, metadata);
    },
  };
}

function supabaseCoreTimelineService(supabase: SupabaseClient<Database>): CoreTimelineService {
  return {
    getTimelineForOwner: (workspaceId, ownerType, ownerId) => fetchTimelineForOwnerSupabase(supabase, workspaceId, ownerType, ownerId),
    recordActivity: (workspaceId, ownerType, ownerId, actor, type, description, metadata) =>
      recordTimelineActivitySupabase(supabase, workspaceId, ownerType, ownerId, actor, type, description, metadata),
  };
}

export function getCoreTimelineService(supabaseClient?: SupabaseClient<Database>): CoreTimelineService {
  if (getDataMode() === "supabase") {
    if (!supabaseClient) {
      throw new Error("getCoreTimelineService requires a supabaseClient in 'supabase' data mode.");
    }
    return supabaseCoreTimelineService(supabaseClient);
  }
  return mockCoreTimelineService();
}
