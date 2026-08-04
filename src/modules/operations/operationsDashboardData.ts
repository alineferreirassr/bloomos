import {
  getEvents,
  getChecklistByEventId,
  getLowStockInventoryItems,
  getDamagedOrUnderRepairInventoryItems,
  getOverduePurchases,
  getWorkspaceFinancialSummary,
  listEventServicesByEvent,
  listEventServiceVendorAssignments,
} from "@/lib/data";
import type { ServerRepositoryContext } from "@/lib/auth/workspaceSession";
import { getEventHealthDetails } from "@/core/workflows/eventHealth";
import { computeChecklistStats } from "@/modules/events/checklistStats";
import type { Event } from "@/types/event";
import type { InventoryItem } from "@/types/inventoryItem";
import type { Purchase } from "@/types/purchase";
import type { WorkspaceFinancialSummary } from "@/modules/finance/financialSummary";

const UPCOMING_WINDOW_DAYS = 14;

export interface OperationsDashboardEventHealth {
  event: Event;
  score: number;
}

export interface OperationsDashboardData {
  eventsToday: Event[];
  upcomingEvents: Event[];
  lateTaskCount: number;
  /** v2 Checkpoint 23 — total checklist items across `upcomingEvents` (the same population `lateTaskCount` is scoped to), for the Business Health Score's `team` dimension. */
  totalChecklistItemCount: number;
  lowStockItems: InventoryItem[];
  damagedItems: InventoryItem[];
  overduePurchases: Purchase[];
  unconfirmedVendorAssignmentCount: number;
  /** v2 Checkpoint 23 — distinct vendor ids with a `confirmed` assignment across `upcomingEvents`, for Operations Analytics' own Vendor Utilization figure. */
  confirmedVendorIds: string[];
  /** v2 Checkpoint 23 — distinct `Event.assigned_owner` names across `upcomingEvents`, for Operations Analytics' own Team Utilization figure. */
  assignedTeamMemberNames: string[];
  financialSummary: WorkspaceFinancialSummary;
  eventHealthScores: OperationsDashboardEventHealth[];
}

function isToday(eventDate: string | null): boolean {
  if (!eventDate) return false;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).setHours(0, 0, 0, 0);
  return eventMidnight === new Date().setHours(0, 0, 0, 0);
}

function daysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).getTime();
  const todayMidnight = new Date().setHours(0, 0, 0, 0);
  return Math.round((eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * The workspace-wide Operations Dashboard (v2 Checkpoint 21, Step 13). A
 * lighter cousin of `getEventOperationsData` (the Command Center's own,
 * per-event data seam) — it deliberately reuses only `eventHealth.ts`'s
 * base score, not the full Operations Health Score v2 (HealthScoreEngine),
 * to keep the fan-out bounded: computing the full v2 score (which needs
 * financial/inventory/vendor/team/purchase lookups per event) for every
 * upcoming event workspace-wide would mean dozens of nested Promise.all()
 * calls on a single dashboard load. The Command Center remains the place
 * to see one event's full Operations Health Score.
 */
export async function getOperationsDashboardData(context?: ServerRepositoryContext): Promise<OperationsDashboardData> {
  const [events, lowStockItems, damagedItems, overduePurchases, financialSummary] = await Promise.all([
    getEvents({ includeArchived: false }, context),
    getLowStockInventoryItems().catch(() => []),
    getDamagedOrUnderRepairInventoryItems().catch(() => []),
    getOverduePurchases().catch(() => []),
    getWorkspaceFinancialSummary(context),
  ]);

  const activeEvents = events.filter((event) => event.status !== "cancelled" && event.status !== "archived");
  const eventsToday = activeEvents.filter((event) => isToday(event.event_date));
  const upcomingEvents = activeEvents
    .filter((event) => {
      const days = daysUntil(event.event_date);
      return days !== null && days >= 0 && days <= UPCOMING_WINDOW_DAYS;
    })
    .sort((a, b) => (a.event_date ?? "").localeCompare(b.event_date ?? ""));

  const checklistLists = await Promise.all(upcomingEvents.map((event) => getChecklistByEventId(event.id, context)));
  const lateTaskCount = checklistLists.reduce((sum, checklist) => sum + computeChecklistStats(checklist).overdue, 0);
  const totalChecklistItemCount = checklistLists.reduce((sum, checklist) => sum + checklist.length, 0);

  const eventHealthScores: OperationsDashboardEventHealth[] = upcomingEvents.map((event, index) => {
    const checklist = checklistLists[index];
    const stats = computeChecklistStats(checklist);
    const score = getEventHealthDetails(
      { status: event.status, priority: event.priority, location_name: event.location_name, address: event.address, budget_min: event.budget_min, budget_max: event.budget_max },
      { hasChecklistItems: checklist.length > 0, hasOverdueChecklistItems: stats.overdue > 0, hasScheduleItems: true, hasPostEventReview: false, daysUntilEvent: daysUntil(event.event_date) },
    ).score;
    return { event, score };
  });

  const servicesLists = await Promise.all(upcomingEvents.map((event) => listEventServicesByEvent(event.id).catch(() => [])));
  const vendorAssignmentLists = await Promise.all(
    servicesLists.flat().map((service) => listEventServiceVendorAssignments(service.id).catch(() => [])),
  );
  const unconfirmedVendorAssignmentCount = vendorAssignmentLists.flat().filter((assignment) => assignment.status !== "confirmed").length;
  const confirmedVendorIds = [...new Set(vendorAssignmentLists.flat().filter((assignment) => assignment.status === "confirmed").map((assignment) => assignment.vendor_id))];
  const assignedTeamMemberNames = [...new Set(upcomingEvents.filter((event) => event.assigned_owner !== null).map((event) => event.assigned_owner as string))];

  return {
    eventsToday,
    upcomingEvents,
    lateTaskCount,
    totalChecklistItemCount,
    lowStockItems,
    damagedItems,
    overduePurchases,
    unconfirmedVendorAssignmentCount,
    confirmedVendorIds,
    assignedTeamMemberNames,
    financialSummary,
    eventHealthScores: eventHealthScores.sort((a, b) => a.score - b.score),
  };
}
