import type { ServiceHealthMissingItem, TemplateCategoryKey } from "@/lib/queries/services/types";
import type { ServiceDetailTabValue } from "@/modules/services/components/ServiceDetailTabs";
import type { RequirementCardVariant } from "@/modules/services/components/RequirementCard";

/** Where a Health issue's `jumpTo` actually lands — the one place a `jumpTo` value is ever turned into a tab (+ optional in-tab scroll target), so the Health tab and the Overview health card never diverge on what "jump to X" means. */
export interface HealthNavigationTarget {
  tab: ServiceDetailTabValue;
  category?: TemplateCategoryKey;
}

export function resolveHealthNavigationTarget(jumpTo: ServiceHealthMissingItem["jumpTo"]): HealthNavigationTarget {
  if (jumpTo.kind === "templateCategory") {
    return { tab: "templates", category: jumpTo.category };
  }
  return { tab: "overview" };
}

/**
 * The 9 individual signals `getServiceHealth` can ever push onto
 * `missing[]` (see WEIGHTS + the resource-signal's 3-way push in
 * lib/queries/services/health.ts) — display metadata only (label, the exact
 * string health.ts uses for this signal's `missing[].label`, where clicking
 * it navigates, and which of the 5 existing `RequirementCardVariant`s it
 * happens to match). Pass/fail for each is decided purely by checking
 * whether `label` is present in the real `health.missing[]` the query layer
 * already returned; nothing here recomputes a score or a weight.
 *
 * `basePrice` is the only signal that also gates Publish (see
 * canPublishServiceVersion) — the one entry treated as "blocking" rather
 * than "warning" anywhere in the Health Dashboard, since every other signal
 * is a completeness recommendation, never a publish blocker.
 */
export type HealthCategoryKey = "basePrice" | "checklist" | "timeline" | "teamRoles" | "budget" | "vendors" | "inventory" | "purchases" | "questionnaire";

export interface HealthCategoryDefinition {
  key: HealthCategoryKey;
  label: string;
  /** The exact `label` string `health.ts` pushes onto `missing[]` for this signal. */
  missingLabel: string;
  jumpTo: ServiceHealthMissingItem["jumpTo"];
  severity: "blocking" | "warning";
  requirementVariant?: RequirementCardVariant;
}

export const HEALTH_CATEGORY_DEFINITIONS: HealthCategoryDefinition[] = [
  { key: "basePrice", label: "Base price", missingLabel: "Set a base price", jumpTo: { kind: "draftVersionForm" }, severity: "blocking" },
  { key: "checklist", label: "Checklist", missingLabel: "Checklist", jumpTo: { kind: "templateCategory", category: "checklistItems" }, severity: "warning" },
  { key: "timeline", label: "Timeline", missingLabel: "Timeline", jumpTo: { kind: "templateCategory", category: "timelineItems" }, severity: "warning" },
  { key: "teamRoles", label: "Team roles", missingLabel: "Team roles", jumpTo: { kind: "templateCategory", category: "teamRoleRequirements" }, severity: "warning", requirementVariant: "team" },
  { key: "budget", label: "Budget", missingLabel: "Budget", jumpTo: { kind: "templateCategory", category: "budgetLines" }, severity: "warning", requirementVariant: "budget" },
  { key: "vendors", label: "Vendor suggestions", missingLabel: "Vendor", jumpTo: { kind: "templateCategory", category: "vendorSuggestions" }, severity: "warning", requirementVariant: "vendor" },
  { key: "inventory", label: "Inventory needs", missingLabel: "Inventory", jumpTo: { kind: "templateCategory", category: "inventoryItems" }, severity: "warning", requirementVariant: "inventory" },
  { key: "purchases", label: "Purchase needs", missingLabel: "Purchase", jumpTo: { kind: "templateCategory", category: "purchaseItems" }, severity: "warning", requirementVariant: "purchase" },
  { key: "questionnaire", label: "Questionnaire", missingLabel: "Questionnaire", jumpTo: { kind: "templateCategory", category: "questionnaireQuestions" }, severity: "warning" },
];

export interface HealthCategoryStatus extends HealthCategoryDefinition {
  isMissing: boolean;
}

/** Groups `health.missing[]` by the 9 canonical signals above — a membership check against data the query layer already decided, never a recomputation of the underlying score. */
export function deriveHealthCategoryStatuses(missing: ServiceHealthMissingItem[]): HealthCategoryStatus[] {
  const missingLabels = new Set(missing.map((item) => item.label));
  return HEALTH_CATEGORY_DEFINITIONS.map((definition) => ({ ...definition, isMissing: missingLabels.has(definition.missingLabel) }));
}
