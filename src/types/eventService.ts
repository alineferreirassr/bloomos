import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";

/**
 * One Service assigned to one Event — the Instance layer. `service_id`
 * stays for "what kind of Service is this, generally" grouping/reporting;
 * `service_version_id` is the real pin — permanent, and never changes even
 * after the catalog Service publishes v3, v4, v5... Generated on assignment
 * by `buildEventServiceAssignmentPlan` (core/workflows/eventServiceWorkflow.ts),
 * which also produces the real ChecklistItem/EventScheduleItem rows and every
 * EventServiceInventoryRequirement/PurchaseRequirement/BudgetLine/
 * TeamRequirement/VendorAssignment row this EventService owns.
 *
 * `name`/`price_minor` are this booking's live, possibly-overridden values;
 * `name_template_value`/`price_template_value` are frozen copies of exactly
 * what the pinned ServiceVersion said at assignment time (price includes any
 * `selected_add_on_ids` chosen then). `isNameOverridden`/`isPriceOverridden`
 * style comparisons belong in the UI/workflow layer, not stored — the same
 * "computed, not persisted" rule the override strategy uses everywhere else
 * (see ChecklistItem/EventScheduleItem's own `template_snapshot`).
 *
 * Never auto-mutates Finance/Inventory/Purchases — every requirement row
 * this produces is a draft/estimate a human reviews before it becomes
 * something real.
 */
export interface EventService {
  id: string;
  workspace_id: string;
  event_id: string;
  service_id: string;
  service_version_id: string;
  name: string;
  name_template_value: string;
  price_minor: number;
  price_template_value: number;
  currency: string;
  selected_add_on_ids: string[];
  status: EventServiceStatus;
  assigned_at: string;
  assigned_by: string;
  created_at: string;
  updated_at: string;
}
