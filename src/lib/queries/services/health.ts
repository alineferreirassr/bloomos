import {
  getService,
  getServiceVersion,
  listServices,
  listServiceCategories,
  listServiceChecklistTemplateItems,
  listServiceTimelineTemplateItems,
  listServiceTeamRoleRequirements,
  listServiceBudgetTemplateLines,
  listServiceVendorSuggestions,
  listServiceInventoryTemplateItems,
  listServicePurchaseTemplateItems,
  listServiceQuestionnaireQuestions,
} from "@/lib/data";
import type { ServiceFilters } from "@/lib/data/services/repository";
import type { ServiceHealthSummary, HealthDashboardData, HealthDashboardRow } from "@/lib/queries/services/types";

/**
 * The MVP Health heuristic — a query-layer composition over existing
 * template-row counts, deliberately not a new backend concept (docs/
 * services.md defers real "Service Health" scoring to Phase 2c). Only the
 * "usually expected" categories (per the Template Builder's own
 * optional/expected split) count toward the score; every other template
 * category is genuinely optional and never appears as "missing." Computed
 * against the DRAFT version — that's the version actively being worked on;
 * a published version is frozen and has nothing left to "complete."
 *
 * Weights sum to 100 and were chosen, not measured — if Phase 2c ever
 * replaces this with real scoring, only this function changes; every
 * consumer already only depends on the resulting { percent, missing } shape.
 */
const WEIGHTS = {
  basePrice: 20,
  checklist: 15,
  timeline: 15,
  teamRoles: 15,
  budget: 15,
  resource: 10,
  questionnaire: 10,
} as const;

/** Below this percent, a Service counts toward the Health Dashboard's "needs attention" total — exported so UI components (HealthDot/HealthGauge) apply the exact same cutoff rather than re-guessing it. */
export const HEALTH_ATTENTION_THRESHOLD = 70;

export async function getServiceHealth(serviceId: string): Promise<ServiceHealthSummary> {
  const service = await getService(serviceId);
  const draftVersionId = service.draft_version_id;
  if (!draftVersionId) {
    // Every Service is created with a draft — this is defensive only.
    return { percent: 0, missing: [{ label: "Set a base price", jumpTo: { kind: "draftVersionForm" } }] };
  }

  const [draft, checklist, timeline, teamRoles, budget, vendors, inventory, purchases, questionnaire] = await Promise.all([
    getServiceVersion(draftVersionId),
    listServiceChecklistTemplateItems(draftVersionId),
    listServiceTimelineTemplateItems(draftVersionId),
    listServiceTeamRoleRequirements(draftVersionId),
    listServiceBudgetTemplateLines(draftVersionId),
    listServiceVendorSuggestions(draftVersionId),
    listServiceInventoryTemplateItems(draftVersionId),
    listServicePurchaseTemplateItems(draftVersionId),
    listServiceQuestionnaireQuestions(draftVersionId),
  ]);

  let percent = 0;
  const missing: ServiceHealthSummary["missing"] = [];

  if (draft.base_price_minor > 0) {
    percent += WEIGHTS.basePrice;
  } else {
    missing.push({ label: "Set a base price", jumpTo: { kind: "draftVersionForm" } });
  }

  if (checklist.length > 0) {
    percent += WEIGHTS.checklist;
  } else {
    missing.push({ label: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" } });
  }

  if (timeline.length > 0) {
    percent += WEIGHTS.timeline;
  } else {
    missing.push({ label: "Timeline", jumpTo: { kind: "templateCategory", category: "timelineItems" } });
  }

  if (teamRoles.length > 0) {
    percent += WEIGHTS.teamRoles;
  } else {
    missing.push({ label: "Team roles", jumpTo: { kind: "templateCategory", category: "teamRoleRequirements" } });
  }

  if (budget.length > 0) {
    percent += WEIGHTS.budget;
  } else {
    missing.push({ label: "Budget", jumpTo: { kind: "templateCategory", category: "budgetLines" } });
  }

  // One combined "resource" signal — any of the three counts as covered.
  if (vendors.length > 0 || inventory.length > 0 || purchases.length > 0) {
    percent += WEIGHTS.resource;
  } else {
    missing.push({ label: "Vendor", jumpTo: { kind: "templateCategory", category: "vendorSuggestions" } });
    missing.push({ label: "Inventory", jumpTo: { kind: "templateCategory", category: "inventoryItems" } });
    missing.push({ label: "Purchase", jumpTo: { kind: "templateCategory", category: "purchaseItems" } });
  }

  if (questionnaire.length > 0) {
    percent += WEIGHTS.questionnaire;
  } else {
    missing.push({ label: "Questionnaire", jumpTo: { kind: "templateCategory", category: "questionnaireQuestions" } });
  }

  return { percent, missing };
}

/**
 * The portfolio-wide work-queue view. Computes health for every matching
 * Service in parallel (Promise.all, not sequential) — still one
 * getServiceHealth call per Service under the hood, which is the accepted,
 * disclosed cost of a heuristic built entirely from existing per-category
 * list reads rather than a dedicated aggregate RPC. This is the one screen
 * whose whole purpose justifies that cost; getServicesCatalog deliberately
 * reuses this same function rather than duplicating the computation.
 */
export async function getHealthDashboard(filters: ServiceFilters = {}): Promise<HealthDashboardData> {
  const [services, categories] = await Promise.all([listServices(filters), listServiceCategories(true)]);
  const categoryNameById = new Map(categories.map((category) => [category.id, category.name]));

  const rows: HealthDashboardRow[] = await Promise.all(
    services.map(async (service) => ({
      service,
      categoryName: service.category_id ? (categoryNameById.get(service.category_id) ?? null) : null,
      health: await getServiceHealth(service.id),
    })),
  );

  const belowThresholdCount = rows.filter((row) => row.health.percent < HEALTH_ATTENTION_THRESHOLD).length;
  const averagePercent = rows.length === 0 ? 0 : Math.round(rows.reduce((sum, row) => sum + row.health.percent, 0) / rows.length);

  return { rows, averagePercent, belowThresholdCount };
}
