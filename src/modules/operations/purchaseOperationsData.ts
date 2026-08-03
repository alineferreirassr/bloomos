import { getEvents, listEventServicesByEvent, listEventServicePurchaseRequirements } from "@/lib/data";
import type { Event } from "@/types/event";

/**
 * Purchase Center (v2 Checkpoint 21, Step 8) — "Assigned Event" is the one
 * genuinely missing piece; Requests/Ordered/Delivered/Received/Supplier/
 * Cost/Status are already fully modeled by `Purchase`/`PurchaseStatus` and
 * rendered by the pre-existing Purchases module. No reverse index from a
 * Purchase back to the Event(s) it fulfills exists
 * (`EventServicePurchaseRequirement.fulfilled_purchase_id` only points one
 * way), so this scans active Events' assigned Services' own purchase
 * requirements — bounded the same way `getVendorOperationsSummary` is.
 */
export async function getPurchaseAssignedEvents(purchaseId: string): Promise<Event[]> {
  const events = await getEvents({ includeArchived: false });
  const activeEvents = events.filter((event) => event.status !== "cancelled" && event.status !== "archived");

  const servicesLists = await Promise.all(activeEvents.map((event) => listEventServicesByEvent(event.id)));
  const matches = await Promise.all(
    activeEvents.map(async (event, index) => {
      const requirementLists = await Promise.all(servicesLists[index].map((service) => listEventServicePurchaseRequirements(service.id)));
      const isAssigned = requirementLists.flat().some((requirement) => requirement.fulfilled_purchase_id === purchaseId);
      return isAssigned ? event : null;
    }),
  );

  return matches.filter((event): event is Event => event !== null);
}
