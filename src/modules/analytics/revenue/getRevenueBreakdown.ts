"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getPayments, getEvents, getClients, listEventServicesByEvent, listServices } from "@/lib/data";
import { PAYMENT_STATUSES_COUNTING_TOWARD_PAID } from "@/core/enums/paymentStatus";
import { resolveTrendWindow, filterInWindow, groupByDay, groupByWeek, groupByMonth, groupByKey, type DimensionBreakdownRow } from "@/core/analytics/engine";
import { allocateAcrossEventServices } from "@/modules/analytics/serviceAllocation";
import type { TrendWindowKey } from "@/types/analytics";
import type { RevenueBreakdown, RevenueBreakdownDimension, RevenueBreakdownRow, DrillDownTarget } from "@/types/businessIntelligence";
import type { Payment } from "@/types/payment";

const GENERIC_ACCESS_ERROR = "Revenue Analytics isn't available. You may not have access to it.";

export type GetRevenueBreakdownResult = { success: true; data: RevenueBreakdown } | { success: false; error: string };

function paymentCounts(payment: Payment): boolean {
  return PAYMENT_STATUSES_COUNTING_TOWARD_PAID.includes(payment.status) && payment.payment_type !== "refund";
}

/**
 * v2 Checkpoint 23, Step 2 — Revenue Analytics. Revenue is defined
 * consistently with the Executive Dashboard's "Today's/Monthly Revenue"
 * (Step 1): cash actually collected via succeeding, non-refund Payments —
 * never accrual/invoiced totals, so every "Revenue by X" view agrees with
 * the headline KPI it's a breakdown of.
 */
// Phase 08 — every row this action returns is a real dollar amount, so it now also requires `finance.amounts.view`
// (previously gated on `analytics.view` alone), matching the Phase 06B policy applied elsewhere in Finance.
export async function getRevenueBreakdown(dimension: RevenueBreakdownDimension, windowKey: TrendWindowKey): Promise<GetRevenueBreakdownResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("analytics.view") || !session.permissions.includes("finance.amounts.view")) {
    return { success: false, error: GENERIC_ACCESS_ERROR };
  }

  const { window } = resolveTrendWindow(windowKey);
  const allPayments = await getPayments();
  const payments = filterInWindow(allPayments.filter(paymentCounts), (p) => p.transaction_date, window);
  const totalMinor = payments.reduce((sum, p) => sum + p.amount_minor, 0);

  if (dimension === "day") return { success: true, data: { dimension, totalMinor, rows: toTimeRows(groupByDay(payments, (p) => p.transaction_date, (p) => p.amount_minor, window)) } };
  if (dimension === "week") return { success: true, data: { dimension, totalMinor, rows: toTimeRows(groupByWeek(payments, (p) => p.transaction_date, (p) => p.amount_minor, window)) } };
  if (dimension === "month") return { success: true, data: { dimension, totalMinor, rows: toTimeRows(groupByMonth(payments, (p) => p.transaction_date, (p) => p.amount_minor, window)) } };

  if (dimension === "event") {
    const events = await getEvents({ includeArchived: true });
    const eventById = new Map(events.map((e) => [e.id, e]));
    const rows = toRevenueRows(
      groupByKey(
        payments,
        (p) => {
          const event = p.event_id ? eventById.get(p.event_id) : undefined;
          return event ? { key: event.id, label: event.title } : null;
        },
        (p) => p.amount_minor,
      ),
      (key) => ({ kind: "events", label: "View event", href: `/events/${key}` }),
    );
    return { success: true, data: { dimension, totalMinor, rows } };
  }

  if (dimension === "client") {
    const clients = await getClients({ includeArchived: true });
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const rows = toRevenueRows(
      groupByKey(
        payments,
        (p) => {
          const client = clientById.get(p.client_id);
          return client ? { key: client.id, label: `${client.first_name} ${client.last_name}`.trim() } : null;
        },
        (p) => p.amount_minor,
      ),
      (key) => ({ kind: "clients", label: "View client", href: `/clients/${key}` }),
    );
    return { success: true, data: { dimension, totalMinor, rows } };
  }

  if (dimension === "source") {
    const clients = await getClients({ includeArchived: true });
    const clientById = new Map(clients.map((c) => [c.id, c]));
    const rows = toRevenueRows(
      groupByKey(
        payments,
        (p) => {
          const source = clientById.get(p.client_id)?.source;
          return source ? { key: source, label: source } : null;
        },
        (p) => p.amount_minor,
      ),
      () => null,
    );
    return { success: true, data: { dimension, totalMinor, rows } };
  }

  if (dimension === "team") {
    const events = await getEvents({ includeArchived: true });
    const eventById = new Map(events.map((e) => [e.id, e]));
    const rows = toRevenueRows(
      groupByKey(
        payments,
        (p) => {
          const owner = p.event_id ? eventById.get(p.event_id)?.assigned_owner : null;
          return owner ? { key: owner, label: owner } : null;
        },
        (p) => p.amount_minor,
      ),
      () => null,
    );
    return { success: true, data: { dimension, totalMinor, rows } };
  }

  // dimension === "service" — allocated proportionally across each payment's Event's assigned Services (by price_minor share), since Payments have no direct service line-item link. See docs/executive-dashboard.md's Known Limitations.
  const [events, services] = await Promise.all([getEvents({ includeArchived: true }), listServices({ includeArchived: true })]);
  const eventById = new Map(events.map((e) => [e.id, e]));
  const serviceById = new Map(services.map((s) => [s.id, s]));
  const eventServicesByEventId = new Map<string, Awaited<ReturnType<typeof listEventServicesByEvent>>>();
  const eventIds = [...new Set(payments.map((p) => p.event_id).filter((id): id is string => id !== null))];
  const eventServiceLists = await Promise.all(eventIds.map((id) => listEventServicesByEvent(id)));
  eventIds.forEach((id, index) => eventServicesByEventId.set(id, eventServiceLists[index]));

  const buckets = new Map<string, RevenueBreakdownRow>();
  for (const payment of payments) {
    if (!payment.event_id || !eventById.has(payment.event_id)) continue;
    const eventServices = eventServicesByEventId.get(payment.event_id) ?? [];
    allocateAcrossEventServices(payment.amount_minor, eventServices, (serviceId, share) => {
      const eventService = eventServices.find((es) => es.service_id === serviceId);
      const label = serviceById.get(serviceId)?.name ?? eventService?.name ?? serviceId;
      const existing = buckets.get(serviceId);
      if (existing) existing.revenueMinor += share;
      else buckets.set(serviceId, { key: serviceId, label, revenueMinor: share, drillDown: { kind: "services", label: "View service", href: `/services/${serviceId}` } });
    });
  }
  const rows = [...buckets.values()].sort((a, b) => b.revenueMinor - a.revenueMinor);
  return { success: true, data: { dimension, totalMinor, rows } };
}

function toTimeRows(series: { label: string; value: number }[]): RevenueBreakdownRow[] {
  return series.map((point) => ({ key: point.label, label: point.label, revenueMinor: point.value, drillDown: null }));
}

function toRevenueRows(rows: DimensionBreakdownRow[], drillDownFor: (key: string) => DrillDownTarget | null): RevenueBreakdownRow[] {
  return rows.map((row) => ({ key: row.key, label: row.label, revenueMinor: row.value, drillDown: drillDownFor(row.key) }));
}
