"use server";

import { resolveMemberSessionSnapshot } from "@/lib/auth/memberSessionSnapshot";
import { getEvents, listServices, listEventServicesByEvent } from "@/lib/data";

const GENERIC_ACCESS_ERROR = "Event Intelligence isn't available. You may not have access to it.";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface SeasonalityPoint {
  month: string;
  count: number;
}

export interface PopularServiceRow {
  serviceId: string;
  name: string;
  eventCount: number;
}

export interface EventIntelligenceData {
  /** Event count bucketed by calendar month-of-year (Jan-Dec), summed across every year of history — real seasonality, not a fabricated curve. */
  seasonality: SeasonalityPoint[];
  popularServices: PopularServiceRow[];
  cancellationRatePercent: number;
  /** Average days between an Event's `created_at` (when it entered the system) and its own `event_date` — "how far in advance is a typical event booked." `null` with no dated events. */
  averagePlanningDays: number | null;
  /** Average `guest_count` across events that have one recorded. `null` when none do. */
  averageEventSize: number | null;
  /** Average of (`budget_min`+`budget_max`)/2 where both are set, else whichever bound is set, across events with at least one bound recorded. `null` when none do. */
  averageBudgetMajor: number | null;
  /** Average hours between `start_time` and `end_time` across events with both set. `null` when none do. */
  averageDurationHours: number | null;
}

export type GetEventIntelligenceDataResult = { success: true; data: EventIntelligenceData } | { success: false; error: string };

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function parseTimeToMinutes(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** v2 Checkpoint 23, Step 6 — Event Intelligence. */
export async function getEventIntelligenceData(): Promise<GetEventIntelligenceDataResult> {
  const session = await resolveMemberSessionSnapshot();
  if (session.kind !== "active") return { success: false, error: GENERIC_ACCESS_ERROR };
  if (!session.permissions.includes("events.view")) return { success: false, error: GENERIC_ACCESS_ERROR };

  const [events, services] = await Promise.all([getEvents({ includeArchived: true }), listServices({ includeArchived: true })]);
  const serviceById = new Map(services.map((s) => [s.id, s]));

  const seasonalityCounts = new Map<number, number>();
  for (const event of events) {
    if (!event.event_date) continue;
    const month = new Date(event.event_date).getUTCMonth();
    seasonalityCounts.set(month, (seasonalityCounts.get(month) ?? 0) + 1);
  }
  const seasonality: SeasonalityPoint[] = MONTH_LABELS.map((label, index) => ({ month: label, count: seasonalityCounts.get(index) ?? 0 }));

  const nonArchivedEvents = events.filter((e) => e.status !== "archived");
  const cancelledCount = nonArchivedEvents.filter((e) => e.status === "cancelled").length;
  const cancellationRatePercent = nonArchivedEvents.length === 0 ? 0 : (cancelledCount / nonArchivedEvents.length) * 100;

  const planningDays = events.filter((e) => e.event_date !== null).map((e) => (new Date(e.event_date as string).getTime() - new Date(e.created_at).getTime()) / (24 * 60 * 60 * 1000));
  const averagePlanningDays = average(planningDays);

  const averageEventSize = average(events.filter((e) => e.guest_count !== null).map((e) => e.guest_count as number));

  const budgets = events
    .filter((e) => e.budget_min !== null || e.budget_max !== null)
    .map((e) => {
      if (e.budget_min !== null && e.budget_max !== null) return (e.budget_min + e.budget_max) / 2;
      return (e.budget_min ?? e.budget_max) as number;
    });
  const averageBudgetMajor = average(budgets);

  const durationsHours = events
    .filter((e) => e.start_time !== null && e.end_time !== null)
    .map((e) => {
      const start = parseTimeToMinutes(e.start_time as string);
      const end = parseTimeToMinutes(e.end_time as string);
      if (start === null || end === null) return null;
      const diff = end >= start ? end - start : end + 24 * 60 - start; // handles an event spanning past midnight
      return diff / 60;
    })
    .filter((v): v is number => v !== null);
  const averageDurationHours = average(durationsHours);

  const activeEvents = events.filter((e) => e.status !== "cancelled" && e.status !== "archived");
  const eventServiceLists = await Promise.all(activeEvents.map((e) => listEventServicesByEvent(e.id)));
  const serviceCounts = new Map<string, number>();
  for (const list of eventServiceLists) {
    const distinctServiceIds = new Set(list.map((es) => es.service_id));
    for (const serviceId of distinctServiceIds) serviceCounts.set(serviceId, (serviceCounts.get(serviceId) ?? 0) + 1);
  }
  const popularServices: PopularServiceRow[] = [...serviceCounts.entries()]
    .map(([serviceId, eventCount]) => ({ serviceId, name: serviceById.get(serviceId)?.name ?? serviceId, eventCount }))
    .sort((a, b) => b.eventCount - a.eventCount);

  return {
    success: true,
    data: { seasonality, popularServices, cancellationRatePercent, averagePlanningDays, averageEventSize, averageBudgetMajor, averageDurationHours },
  };
}
