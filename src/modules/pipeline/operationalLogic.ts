import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { EventLifecycleStage } from "@/core/enums/eventLifecycleStage";
import type { EventType } from "@/core/enums/eventType";
import type { EventPriority } from "@/core/enums/eventPriority";
import type { EventHealthStatus } from "@/core/workflows/eventHealth";
import { OPERATIONAL_COLUMNS } from "@/modules/pipeline/operationalConstants";
import { getFullName } from "@/lib/personName";

/**
 * One card's worth of already-aggregated data — event plus everything the
 * board needs to answer "what is this, when is it, is it blocked, what's
 * next" without the card component fetching or deriving anything itself.
 * Assembled once per board load (see OperationalPipelineBoard's loader),
 * mirroring EventsListView's own EventListRow shape.
 */
export interface OperationalCardData {
  event: Event;
  client: Client | undefined;
  checklistTotal: number;
  checklistCompleted: number;
  checklistOverdue: number;
  scheduleTotal: number;
  scheduleCompleted: number;
  nextAction: string | null;
  healthStatus: EventHealthStatus;
  daysUntilEvent: number | null;
}

export interface OperationalPipelineFilterValues {
  search: string;
  eventType: EventType | "all";
  priority: EventPriority | "all";
  owner: string | "all" | "unassigned";
  healthStatus: EventHealthStatus | "all";
  overdueOnly: boolean;
  upcomingOnly: boolean;
}

export const EMPTY_OPERATIONAL_FILTERS: OperationalPipelineFilterValues = {
  search: "",
  eventType: "all",
  priority: "all",
  owner: "all",
  healthStatus: "all",
  overdueOnly: false,
  upcomingOnly: false,
};

/** An event card counts as "upcoming" inside this window — same 7-day horizon eventHealth.ts already uses for its own "approaching" deduction, so the filter agrees with what the health badge is already reacting to. */
const UPCOMING_WINDOW_DAYS = 7;

/** Every distinct non-empty assigned_owner across the board's cards, for the owner filter's own options list. */
export function collectOwners(cards: OperationalCardData[]): string[] {
  const set = new Set<string>();
  for (const card of cards) {
    if (card.event.assigned_owner) set.add(card.event.assigned_owner);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * All filtering happens in memory over one already-fetched, already-aggregated
 * card list — same rationale as filterCommercialLeads: the board loads every
 * non-archived Event once rather than issuing one query per filter, and none
 * of these filters (health status, overdue, upcoming, owner) are part of the
 * shared EventFilters repository contract, so pushing them server-side would
 * mean widening that contract for every other Event view too.
 */
export function filterOperationalCards(cards: OperationalCardData[], filters: OperationalPipelineFilterValues): OperationalCardData[] {
  const search = filters.search.trim().toLowerCase();

  return cards.filter((card) => {
    if (search) {
      const haystack = `${card.event.title} ${card.client ? getFullName(card.client) : ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.eventType !== "all" && card.event.event_type !== filters.eventType) return false;
    if (filters.priority !== "all" && card.event.priority !== filters.priority) return false;
    if (filters.owner === "unassigned" && card.event.assigned_owner !== null) return false;
    if (filters.owner !== "all" && filters.owner !== "unassigned" && card.event.assigned_owner !== filters.owner) return false;
    if (filters.healthStatus !== "all" && card.healthStatus !== filters.healthStatus) return false;
    if (filters.overdueOnly && card.checklistOverdue === 0) return false;
    if (filters.upcomingOnly) {
      if (card.daysUntilEvent === null || card.daysUntilEvent < 0 || card.daysUntilEvent > UPCOMING_WINDOW_DAYS) return false;
    }
    return true;
  });
}

export type OperationalBoardColumns = Record<EventLifecycleStage, OperationalCardData[]>;

/** Groups already-filtered cards by their Event's current lifecycle_stage — a direct 1:1 mapping, no bucketing needed since every stage is already its own column. */
export function groupCardsByColumn(cards: OperationalCardData[]): OperationalBoardColumns {
  const columns = Object.fromEntries(OPERATIONAL_COLUMNS.map((c) => [c.id, [] as OperationalCardData[]])) as OperationalBoardColumns;
  for (const card of cards) {
    columns[card.event.lifecycle_stage].push(card);
  }
  return columns;
}

/**
 * event_date is a "YYYY-MM-DD" date-only string — new Date(event_date)
 * parses as UTC midnight, which shifts the result by a day for anyone in a
 * timezone behind UTC. This reimplements EventDetailView's own corrected
 * local-midnight comparison locally (rather than importing it) so Pipeline
 * never re-introduces the bug Events already fixed, without adding a
 * cross-module dependency on an Events UI file for one date calculation.
 */
export function getDaysUntilEventDate(eventDate: string | null, now: Date = new Date()): number | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).getTime();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}
