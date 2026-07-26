import type { ChecklistCategory } from "@/core/enums/checklistCategory";
import type { NotePriority } from "@/core/enums/notePriority";

/**
 * One reusable checklist item a Service generates on every Event it's
 * assigned to. Reuses ChecklistCategory/NotePriority (the exact same
 * vocabulary real `checklist_items` rows already use) rather than a
 * near-duplicate Service-specific enum, since assignService copies this row
 * directly into a real ChecklistItem — see
 * core/workflows/eventServiceWorkflow.ts's buildEventServiceAssignmentPlan.
 * `due_offset_days` is resolved against the Event's own date at generation
 * time to produce that real item's `due_date`.
 */
export interface ServiceChecklistTemplateItem {
  id: string;
  workspace_id: string;
  service_version_id: string;
  title: string;
  description: string | null;
  category: ChecklistCategory;
  priority: NotePriority;
  due_offset_days: number | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}
