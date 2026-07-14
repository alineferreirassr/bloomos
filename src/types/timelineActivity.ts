import type { TimelineActivityType } from "@/core/enums/timelineActivityType";
import type { EntityType } from "@/core/enums/entityType";

/**
 * A timeline entry can belong to a Lead or a Client (`owner_type` + `owner_id`) —
 * one shared shape recorded through a single mechanism (`recordTimelineActivity`),
 * never constructed by hand in UI or module code.
 *
 * A polymorphic owner means `owner_id` can't carry a normal foreign-key
 * constraint (it points at `leads.id` for one row and `clients.id` for the
 * next) — see docs/database.md's `timeline_activities` section for how
 * ownership and workspace consistency get enforced instead (data-layer
 * validation now, Supabase RLS once connected). Every query MUST filter by
 * `workspace_id` together with `owner_type`/`owner_id`, never `owner_id` alone.
 */
export interface TimelineActivity {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  type: TimelineActivityType;
  description: string;
  actor: string;
  timestamp: string;
  metadata?: Record<string, string | number | boolean | null>;
}
