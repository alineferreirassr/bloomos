import {
  getEventById,
  getClientById,
  getChecklistByEventId,
  getScheduleByEventId,
  getContracts,
  getEventFinancialSummary,
  listEventServicesByEvent,
  listEventServiceInventoryRequirements,
  listEventServicePurchaseRequirements,
  listEventServiceBudgetLines,
  listEventServiceTeamRequirements,
  listEventServiceVendorAssignments,
  getInventoryItem,
  listInventoryMovements,
  getLowStockInventoryItems,
  getWorkspaceMembers,
  getVendors,
  getPayments,
  getExpenses,
  getMediaAssetsByOwner,
  getOverduePurchases,
  getPurchase,
} from "@/lib/data";
import { getLatestProposalForEvent } from "@/modules/ai/proposal/getLatestProposalForEvent";
import { getLiveEventLog } from "@/core/operations/operationsStore";
import { getOperationsHealth, type OperationsHealthDetails } from "@/core/operations/healthScoreEngine";
import { detectOperationsRisks } from "@/core/operations/riskEngine";
import { buildPackingList, groupPackingListByCategory } from "@/core/operations/packingEngine";
import { buildLogisticsPlan } from "@/core/operations/logisticsEngine";
import { buildOperationsBudget, isOverBudget } from "@/core/operations/budgetEngine";
import { buildOperationsTimeline } from "@/core/operations/timelineEngine";
import { computeChecklistStats } from "@/modules/events/checklistStats";
import type { Event } from "@/types/event";
import type { Client } from "@/types/client";
import type { TeamMember } from "@/types/teamMember";
import type { Vendor } from "@/types/vendor";
import type { EventServiceVendorAssignment } from "@/types/eventServiceVendorAssignment";
import type { EventServiceTeamRequirement } from "@/types/eventServiceTeamRequirement";
import type { EventServicePurchaseRequirement } from "@/types/eventServicePurchaseRequirement";
import type { Purchase } from "@/types/purchase";
import type { OperationsRisk, OperationsBudget, PackingCategory, PackingListItem, LogisticsPlan, OperationsTimelineEntry } from "@/core/operations/types";

export interface EventOperationsData {
  event: Event;
  client: Client | null;
  daysUntilEvent: number | null;
  health: OperationsHealthDetails;
  risks: OperationsRisk[];
  budget: OperationsBudget;
  packingGroups: Array<{ category: PackingCategory; items: PackingListItem[] }>;
  logistics: LogisticsPlan;
  timeline: OperationsTimelineEntry[];
  vendorAssignments: Array<{ assignment: EventServiceVendorAssignment; vendor: Vendor | null }>;
  teamRequirements: Array<{ requirement: EventServiceTeamRequirement; member: TeamMember | null }>;
  purchaseRequirements: Array<{ requirement: EventServicePurchaseRequirement; purchase: Purchase | null }>;
  galleryAssetCount: number;
  checklistCompletionPercentage: number;
}

function daysUntil(eventDate: string | null): number | null {
  if (!eventDate) return null;
  const [year, month, day] = eventDate.split("-").map(Number);
  const eventMidnight = new Date(year, month - 1, day).getTime();
  const todayMidnight = new Date().setHours(0, 0, 0, 0);
  return Math.round((eventMidnight - todayMidnight) / (1000 * 60 * 60 * 24));
}

/**
 * The Event Command Center's one data-assembly seam (v2 Checkpoint 21,
 * Step 1) — a plain client-callable function, not a "use server" action,
 * for the same reason every Bloom AI Copilot data function from Checkpoint
 * 20 is: `@/lib/data` resolves to the browser-bound Supabase client in
 * `"supabase"` data mode. Fetches every already-existing piece of data the
 * Command Center needs in parallel, then runs it through the reusable
 * engines (HealthScoreEngine, RiskEngine, PackingEngine, LogisticsEngine,
 * BudgetEngine, TimelineEngine) — never recomputing anything those engines
 * already own.
 */
export async function getEventOperationsData(eventId: string): Promise<EventOperationsData> {
  const event = await getEventById(eventId);

  const [
    client,
    checklist,
    schedule,
    contracts,
    financialSummary,
    services,
    lowStockItems,
    members,
    vendors,
    payments,
    expenses,
    galleryAssets,
    liveEventLog,
    latestProposalResult,
    overduePurchases,
  ] = await Promise.all([
    getClientById(event.client_id).catch(() => null),
    getChecklistByEventId(eventId),
    getScheduleByEventId(eventId),
    getContracts({ eventId }),
    getEventFinancialSummary(eventId),
    listEventServicesByEvent(eventId),
    getLowStockInventoryItems(),
    getWorkspaceMembers(),
    getVendors({ status: "active" }),
    getPayments({ eventId }),
    getExpenses({ eventId }),
    getMediaAssetsByOwner("event", eventId).catch(() => []),
    getLiveEventLog(eventId),
    getLatestProposalForEvent(eventId).catch(() => ({ success: false as const, error: "" })),
    getOverduePurchases(),
  ]);

  const [inventoryRequirementLists, purchaseRequirementLists, budgetLineLists, teamRequirementLists, vendorAssignmentLists] = await Promise.all([
    Promise.all(services.map((service) => listEventServiceInventoryRequirements(service.id))),
    Promise.all(services.map((service) => listEventServicePurchaseRequirements(service.id))),
    Promise.all(services.map((service) => listEventServiceBudgetLines(service.id))),
    Promise.all(services.map((service) => listEventServiceTeamRequirements(service.id))),
    Promise.all(services.map((service) => listEventServiceVendorAssignments(service.id))),
  ]);

  const inventoryRequirements = inventoryRequirementLists.flat();
  const purchaseRequirements = purchaseRequirementLists.flat();
  const budgetLines = budgetLineLists.flat();
  const teamRequirements = teamRequirementLists.flat();
  const vendorAssignments = vendorAssignmentLists.flat();

  const matchedInventoryItemIds = Array.from(new Set(inventoryRequirements.map((r) => r.inventory_item_id).filter((id): id is string => id !== null)));
  const matchedInventoryItems = await Promise.all(matchedInventoryItemIds.map((id) => getInventoryItem(id).catch(() => null)));
  const inventoryItemsById = new Map(matchedInventoryItems.filter((item) => item !== null).map((item) => [item.id, item]));

  const inventoryMovementLists = await Promise.all(matchedInventoryItemIds.map((id) => listInventoryMovements(id)));
  const inventoryMovements = inventoryMovementLists.flat().filter((movement) => movement.reference_type === "event" && movement.reference_id === eventId);

  const purchasesByRequirement = await Promise.all(
    purchaseRequirements.map(async (requirement) => ({
      requirement,
      purchase: requirement.fulfilled_purchase_id ? await getPurchase(requirement.fulfilled_purchase_id).catch(() => null) : null,
    })),
  );

  const membersById = new Map(members.map((m) => [m.id, m]));
  const vendorsById = new Map(vendors.map((v) => [v.id, v]));

  const packingList = buildPackingList(inventoryRequirements, inventoryItemsById);
  const packingGroups = groupPackingListByCategory(packingList);
  const logistics = buildLogisticsPlan(schedule);
  const budget = buildOperationsBudget(budgetLines, financialSummary);

  const daysUntilEvent = daysUntil(event.event_date);
  const checklistStats = computeChecklistStats(checklist);
  const hasActiveContract = contracts.some((c) => !["draft", "cancelled", "expired", "archived", "declined"].includes(c.status));

  const lowStockAssignedItemCount = packingList.filter((item) => item.source === "inventory" && item.inventoryItemId && lowStockItems.some((low) => low.id === item.inventoryItemId)).length;
  const unfulfilledShoppingItemCount = packingList.filter((item) => item.source === "shopping").length;
  const unassignedVendorRequirementCount = vendorAssignments.filter((a) => a.status !== "confirmed").length;
  const unassignedTeamRequirementCount = teamRequirements.filter((r) => r.assigned_member_id === null).length;
  const latePurchaseIds = new Set(overduePurchases.map((p) => p.id));
  const latePurchaseCount = purchasesByRequirement.filter(({ purchase }) => purchase && latePurchaseIds.has(purchase.id)).length;

  const lastActivityDates = [event.updated_at, ...checklist.map((c) => c.updated_at), ...schedule.map((s) => s.updated_at)].sort().reverse();
  const daysSinceLastActivity = lastActivityDates[0] ? Math.round((Date.now() - new Date(lastActivityDates[0]).getTime()) / (1000 * 60 * 60 * 24)) : null;

  const overBudget = isOverBudget(budget);

  const health = getOperationsHealth({
    event: { status: event.status, priority: event.priority, location_name: event.location_name, address: event.address, budget_min: event.budget_min, budget_max: event.budget_max },
    eventHealthContext: {
      hasChecklistItems: checklist.length > 0,
      hasOverdueChecklistItems: checklistStats.overdue > 0,
      hasScheduleItems: schedule.length > 0,
      hasPostEventReview: false,
      daysUntilEvent,
    },
    outstandingBalanceMinor: financialSummary.outstanding_minor,
    hasOverdueInvoice: financialSummary.outstanding_minor > 0 && daysUntilEvent !== null && daysUntilEvent < 0,
    lowStockAssignedItemCount,
    unfulfilledShoppingItemCount,
    unassignedVendorRequirementCount,
    unassignedTeamRequirementCount,
    latePurchaseCount,
    isOverBudget: overBudget,
    daysSinceLastActivity,
    documentCount: contracts.length,
  });

  const risks = detectOperationsRisks({
    hasUnassignedTeamRequirement: unassignedTeamRequirementCount > 0,
    hasLateVendorAssignment: unassignedVendorRequirementCount > 0 && daysUntilEvent !== null && daysUntilEvent <= 14,
    hasLowStockAssignedItem: lowStockAssignedItemCount > 0,
    outstandingBalanceMinor: financialSummary.outstanding_minor,
    hasOverdueInvoice: financialSummary.outstanding_minor > 0 && daysUntilEvent !== null && daysUntilEvent < 0,
    hasActiveContract,
    isOverBudget: overBudget,
    hasLatePurchase: latePurchaseCount > 0,
    hasChecklistItems: checklist.length > 0,
    daysUntilEvent,
  });

  const timeline = buildOperationsTimeline({
    event,
    payments,
    expenses,
    proposals: latestProposalResult.success && latestProposalResult.data ? [latestProposalResult.data] : [],
    vendorAssignments,
    teamRequirements,
    schedule,
    inventoryMovements,
    galleryAssets,
    liveEventLog,
  });

  return {
    event,
    client,
    daysUntilEvent,
    health,
    risks,
    budget,
    packingGroups,
    logistics,
    timeline,
    vendorAssignments: vendorAssignments.map((assignment) => ({ assignment, vendor: vendorsById.get(assignment.vendor_id) ?? null })),
    teamRequirements: teamRequirements.map((requirement) => ({ requirement, member: requirement.assigned_member_id ? (membersById.get(requirement.assigned_member_id) ?? null) : null })),
    purchaseRequirements: purchasesByRequirement,
    galleryAssetCount: galleryAssets.length,
    checklistCompletionPercentage: checklistStats.percentComplete,
  };
}
