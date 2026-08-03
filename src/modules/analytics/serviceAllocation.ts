import type { EventService } from "@/types/eventService";

/**
 * v2 Checkpoint 23 — shared by Revenue Analytics (Step 2, "Revenue by
 * Service") and the Profitability Center (Step 3, "Cost per Service" /
 * "Most/Least Profitable Services"). Neither Payment nor Expense has a
 * direct `service_id` — only `event_id` — so any per-service money figure
 * has to be allocated down from the event level. This allocates
 * proportionally by each EventService's own `price_minor` share of the
 * event's total contracted price, the same defensible, documented method
 * both callers use (see `docs/executive-dashboard.md`'s Known Limitations:
 * it's a real allocation, not a precise line-item trace, since no payment
 * or expense is actually tagged to one specific service).
 */
export function allocateAcrossEventServices(amountMinor: number, eventServices: EventService[], onShare: (serviceId: string, shareMinor: number) => void): void {
  const totalPrice = eventServices.reduce((sum, es) => sum + es.price_minor, 0);
  if (totalPrice <= 0) return;
  for (const eventService of eventServices) {
    const share = Math.round(amountMinor * (eventService.price_minor / totalPrice));
    if (share > 0) onShare(eventService.service_id, share);
  }
}
