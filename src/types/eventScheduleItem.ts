import type { EntityType } from "@/core/enums/entityType";
import type { ScheduleCategory } from "@/core/enums/scheduleCategory";
import type { ScheduleStatus } from "@/core/enums/scheduleStatus";

/**
 * A reusable schedule item — generalized the same way as ChecklistItem
 * (owner_type/owner_id reusing the shared EntityType union) rather than a
 * plain event_id, so Employee/Vendor/Inventory/Vehicle/Client schedules can
 * reuse this exact table later without a redesign. Only "event" is a real
 * owner today.
 *
 * Same polymorphic-owner caveat as Notes/Timeline/Checklist: owner_id can't
 * carry a normal foreign key, so every query MUST scope by workspace_id
 * together with owner_type/owner_id, never owner_id alone.
 */
export interface EventScheduleItem {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  assigned_to: string | null;
  category: ScheduleCategory;
  status: ScheduleStatus;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
