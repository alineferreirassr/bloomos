import {
  getService,
  getServiceVersion,
  listServices,
  listEventServicesByEvent,
  listServiceAddOns,
  listServiceChecklistTemplateItems,
  listServiceTimelineTemplateItems,
  listServiceInventoryTemplateItems,
  listServicePurchaseTemplateItems,
  listServiceBudgetTemplateLines,
  listServiceTeamRoleRequirements,
  listServiceVendorSuggestions,
} from "@/lib/data";
import { canAssignService } from "@/core/workflows/serviceWorkflow";
import { computeServicePrice } from "@/core/workflows/eventServiceWorkflow";
import { getServiceHealth } from "@/lib/queries/services/health";
import type { AssignmentCandidate, AssignmentWorkspaceData, AssignmentPreview } from "@/lib/queries/services/types";

/**
 * Eligible = active status AND has a published version to pin
 * (canAssignService — the exact same pure rule the assign_service_to_event
 * RPC itself enforces), never re-derived with a second, divergent check
 * here.
 */
export async function getAssignmentWorkspace(eventId: string): Promise<AssignmentWorkspaceData> {
  const [services, alreadyAssigned] = await Promise.all([listServices({ status: "active" }), listEventServicesByEvent(eventId)]);

  const eligibleServices: AssignmentCandidate[] = await Promise.all(
    services
      .filter((service) => canAssignService(service))
      .map(async (service) => {
        const publishedVersion = await getServiceVersion(service.current_published_version_id as string);
        const health = await getServiceHealth(service.id);
        return { service, publishedVersion, health };
      }),
  );

  return { eligibleServices, alreadyAssigned };
}

/**
 * A read-only preview of what `assignServiceToEvent` would generate — never
 * calls the mutation itself. Price uses the exact same pure
 * `computeServicePrice` the mock repository and the SQL RPC are both built
 * from, so the preview can never disagree with what actually gets charged.
 * Requirement/checklist/schedule counts are plain row counts, not a second
 * copy of `buildEventServiceAssignmentPlan`'s generation logic — this
 * preview only needs "how many," never the generated rows themselves.
 */
export async function getAssignmentPreview(serviceId: string, selectedAddOnIds: string[]): Promise<AssignmentPreview> {
  const service = await getService(serviceId);
  if (!canAssignService(service)) {
    throw new Error(`Service ${serviceId} has no published version and cannot be assigned yet.`);
  }
  const versionId = service.current_published_version_id as string;

  const [resolvedVersion, addOns, checklist, timeline, inventory, purchases, budget, team, vendors] = await Promise.all([
    getServiceVersion(versionId),
    listServiceAddOns(versionId),
    listServiceChecklistTemplateItems(versionId),
    listServiceTimelineTemplateItems(versionId),
    listServiceInventoryTemplateItems(versionId),
    listServicePurchaseTemplateItems(versionId),
    listServiceBudgetTemplateLines(versionId),
    listServiceTeamRoleRequirements(versionId),
    listServiceVendorSuggestions(versionId),
  ]);

  return {
    service,
    resolvedVersion,
    computedPriceMinor: computeServicePrice(resolvedVersion.base_price_minor, addOns, selectedAddOnIds),
    generatedCounts: {
      checklistItems: checklist.length,
      scheduleItems: timeline.length,
      inventoryRequirements: inventory.length,
      purchaseRequirements: purchases.length,
      budgetLines: budget.length,
      teamRequirements: team.length,
      vendorAssignments: vendors.length,
    },
  };
}
