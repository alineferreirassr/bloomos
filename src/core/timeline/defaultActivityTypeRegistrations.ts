import { registerTimelineActivityType } from "@/core/timeline/activityTypeRegistry";

/**
 * The single, centralized place a module's Timeline activity types + display
 * labels get registered — mirroring `core/search/defaultRegistrations.ts`'s
 * `registerDefaultSearchableEntities` shape exactly. Calling this is opt-in
 * (same rationale as Search's version) rather than a module-load side
 * effect, so importing anything from `core/timeline` — or from a
 * repository that merely *consumes* `recordActivity`/`getTimelineForOwner`
 * — never silently mutates the global registry.
 *
 * A repository (e.g. `lib/data/vendors/supabaseRepository.ts`) must only
 * ever call `getCoreTimelineService(...).recordActivity(...)`; registering
 * new activity types belongs here, not there.
 */
export function registerDefaultTimelineActivityTypes(): void {
  registerTimelineActivityType("vendor_created", "Vendor created");
  registerTimelineActivityType("vendor_updated", "Vendor updated");
  registerTimelineActivityType("vendor_archived", "Vendor archived");
  registerTimelineActivityType("vendor_restored", "Vendor restored");
  registerTimelineActivityType("vendor_preferred_status_changed", "Preferred status changed");

  registerTimelineActivityType("purchase_created", "Purchase created");
  registerTimelineActivityType("purchase_updated", "Purchase updated");
  registerTimelineActivityType("purchase_status_changed", "Purchase status changed");
  registerTimelineActivityType("purchase_archived", "Purchase archived");
  registerTimelineActivityType("purchase_restored", "Purchase restored");
  registerTimelineActivityType("purchase_item_added", "Purchase item added");
  registerTimelineActivityType("purchase_item_updated", "Purchase item updated");
  registerTimelineActivityType("purchase_item_removed", "Purchase item removed");
  registerTimelineActivityType("purchase_item_received", "Purchase item received");

  registerTimelineActivityType("service_created", "Service created");
  registerTimelineActivityType("service_updated", "Service updated");
  registerTimelineActivityType("service_status_changed", "Service status changed");
  registerTimelineActivityType("service_version_published", "Service version published");
  registerTimelineActivityType("event_service_assigned", "Service assigned to Event");
  registerTimelineActivityType("event_service_status_changed", "Assigned Service status changed");
  registerTimelineActivityType("event_service_removed", "Service removed from Event");
}
