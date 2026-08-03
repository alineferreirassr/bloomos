import type { ServiceAssignmentRow } from "@/lib/queries/services/types";
import type { EventServiceStatus } from "@/core/enums/eventServiceStatus";
import { getFullName } from "@/lib/personName";

export type AssignmentTimingFilter = "all" | "upcoming" | "past";
export type AssignmentTeamFilter = "all" | "fully_assigned" | "needs_assignment";

export interface AssignmentFiltersValue {
  status: EventServiceStatus | "all";
  timing: AssignmentTimingFilter;
  search: string;
  versionNumber: number | "all";
  team: AssignmentTeamFilter;
  /** Mirrors the `includeArchived` convention used by every other module's filter bar (Clients, Contracts, Purchases, ...) — an archived Event's assignment is hidden by default, not deleted or excluded from the underlying collection. */
  includeArchived: boolean;
}

export const DEFAULT_ASSIGNMENT_FILTERS: AssignmentFiltersValue = {
  status: "all",
  timing: "all",
  search: "",
  versionNumber: "all",
  team: "all",
  includeArchived: false,
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** An Event with no `event_date` hasn't happened in any sense the domain can express, so it's treated as upcoming rather than guessing a date judgement the row has no data for. */
export function isUpcomingAssignment(eventDate: string | null, now: Date): boolean {
  if (eventDate === null) return true;
  return new Date(eventDate).getTime() >= startOfDay(now).getTime();
}

function matchesSearch(row: ServiceAssignmentRow, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  const clientName = getFullName(row.client).toLowerCase();
  return row.event.title.toLowerCase().includes(query) || clientName.includes(query);
}

/** A row with no team requirements at all (`total === 0`) matches neither "Fully assigned" nor "Needs assignment" — it doesn't participate in either half of that binary, so filtering by it deliberately excludes those rows rather than guessing which side they belong on. */
function matchesTeam(row: ServiceAssignmentRow, filter: AssignmentTeamFilter): boolean {
  if (filter === "all") return true;
  if (row.team.total === 0) return false;
  return filter === "fully_assigned" ? row.team.resolved === row.team.total : row.team.resolved < row.team.total;
}

/**
 * Pure, UI-side filtering over the one already-fetched `useServiceAssignments`
 * result — no repository/query call happens as a result of any filter
 * change, matching the spec's "no client-side recomputation of repository
 * data beyond UI filtering."
 */
export function filterAssignmentRows(rows: ServiceAssignmentRow[], filters: AssignmentFiltersValue, now: Date): ServiceAssignmentRow[] {
  return rows.filter((row) => {
    if (filters.status !== "all" && row.eventService.status !== filters.status) return false;
    if (filters.timing === "upcoming" && !isUpcomingAssignment(row.event.event_date, now)) return false;
    if (filters.timing === "past" && isUpcomingAssignment(row.event.event_date, now)) return false;
    if (filters.versionNumber !== "all" && row.versionNumber !== filters.versionNumber) return false;
    if (!matchesTeam(row, filters.team)) return false;
    if (!matchesSearch(row, filters.search)) return false;
    if (!filters.includeArchived && row.event.status === "archived") return false;
    return true;
  });
}

/** Dated rows always sort before undated ones (an undated Event has nothing to compare); undated rows among themselves fall back to `assigned_at` descending, newest assignment first. `direction` is `1` for ascending (soonest date first) or `-1` for descending (most recent date first). */
function compareByDate(a: ServiceAssignmentRow, b: ServiceAssignmentRow, direction: 1 | -1): number {
  const aDate = a.event.event_date;
  const bDate = b.event.event_date;
  if (aDate && bDate) {
    return direction * (new Date(aDate).getTime() - new Date(bDate).getTime());
  }
  if (aDate) return -1;
  if (bDate) return 1;
  return new Date(b.eventService.assigned_at).getTime() - new Date(a.eventService.assigned_at).getTime();
}

/**
 * "Upcoming events first, then past events. Within each group: nearest
 * event first." — two independently-sorted groups, not one flat
 * date-descending sort: the soonest upcoming Event leads the top of the
 * table, and the most recent past Event leads the bottom group, rather
 * than the farthest-future Event outranking a Event happening tomorrow.
 */
export function sortAssignmentsUpcomingFirst(rows: ServiceAssignmentRow[], now: Date): ServiceAssignmentRow[] {
  const upcoming: ServiceAssignmentRow[] = [];
  const past: ServiceAssignmentRow[] = [];
  for (const row of rows) {
    (isUpcomingAssignment(row.event.event_date, now) ? upcoming : past).push(row);
  }
  upcoming.sort((a, b) => compareByDate(a, b, 1));
  past.sort((a, b) => compareByDate(a, b, -1));
  return [...upcoming, ...past];
}
