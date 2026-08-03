import { getEvents, listEventServicesByEvent, listEventServiceVendorAssignments, getPurchasesByVendorId } from "@/lib/data";
import type { Event } from "@/types/event";
import type { Purchase } from "@/types/purchase";

export interface VendorOperationsSummary {
  assignedEvents: Event[];
  purchaseHistory: Purchase[];
}

/**
 * Vendor Operations (v2 Checkpoint 21, Step 7). "Assigned Events" is a
 * genuine reverse lookup — no `listEventServiceVendorAssignmentsByVendorId`
 * index exists, so this scans active Events' own assigned Services'
 * `EventServiceVendorAssignment` rows and filters to this vendor, bounded
 * to non-archived/cancelled Events to keep the fan-out reasonable (same
 * bound `getOperationsDashboardData` uses). "Payments" and "Contracts"
 * (named in the spec) have no real Vendor-scoped link in this codebase —
 * `getPurchasesByVendorId` (Purchase History) is the closest real proxy and
 * is surfaced honestly under that name, not relabeled as "Payments."
 * "Rating" has no field on `Vendor` — the existing `is_preferred` flag
 * already shown elsewhere on this page is the only real signal.
 */
export async function getVendorOperationsSummary(vendorId: string): Promise<VendorOperationsSummary> {
  const [events, purchaseHistory] = await Promise.all([getEvents({ includeArchived: false }), getPurchasesByVendorId(vendorId)]);
  const activeEvents = events.filter((event) => event.status !== "cancelled" && event.status !== "archived");

  const servicesLists = await Promise.all(activeEvents.map((event) => listEventServicesByEvent(event.id)));
  const assignmentsByEvent = await Promise.all(
    activeEvents.map(async (event, index) => {
      const assignmentLists = await Promise.all(servicesLists[index].map((service) => listEventServiceVendorAssignments(service.id)));
      const hasVendor = assignmentLists.flat().some((assignment) => assignment.vendor_id === vendorId && assignment.status === "confirmed");
      return hasVendor ? event : null;
    }),
  );

  return {
    assignedEvents: assignmentsByEvent.filter((event): event is Event => event !== null),
    purchaseHistory,
  };
}
