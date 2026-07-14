import type { EntityType } from "@/core/enums/entityType";
import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { ChecklistStatus } from "@/core/enums/checklistStatus";
import type { NotePriority } from "@/core/enums/notePriority";
import type { AssignedType } from "@/core/enums/assignedType";

/**
 * A reusable checklist item, not hardcoded to Events — same polymorphic
 * owner_type/owner_id shape as Note and TimelineActivity, reusing the same
 * EntityType union so a future owner (e.g. a Contract) can adopt it without
 * a new type. Only "event" is a real owner today.
 *
 * Same polymorphic-owner caveat as Notes/Timeline: owner_id can't carry a
 * normal foreign key, so every query MUST scope by workspace_id together
 * with owner_type/owner_id, never owner_id alone.
 *
 * priority reuses NotePriority (low/normal/high/critical) rather than a new
 * near-duplicate enum — the four-tier urgency scale means the same thing
 * here as it does on a Note. (Kept independent of EventPriority, which
 * gained a fifth "urgent" tier — Notes/Checklist priority is existing,
 * protected architecture and wasn't touched.)
 *
 * Assignment is generalized the same way ownership is: assigned_type/
 * assigned_id/assigned_name instead of a single assigned_to string, so a
 * checklist item can point at an Employee, Vendor, or Client once those
 * modules exist without another schema change. No Employee/Vendor module
 * exists yet, so assigned_id stays null in practice today — assigned_name
 * carries a free-text display name in the meantime.
 */
export interface ChecklistItem {
  id: string;
  workspace_id: string;
  owner_type: EntityType;
  owner_id: string;
  title: string;
  description: string | null;
  category: ChecklistCategory;
  priority: NotePriority;
  status: ChecklistStatus;
  due_date: string | null;
  completed_at: string | null;
  assigned_type: AssignedType;
  assigned_id: string | null;
  assigned_name: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
