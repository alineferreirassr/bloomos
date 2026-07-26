import { describe, expect, it } from "vitest";
import { resolveHealthNavigationTarget, deriveHealthCategoryStatuses, HEALTH_CATEGORY_DEFINITIONS } from "@/modules/services/serviceHealthNavigation";
import type { ServiceHealthMissingItem } from "@/lib/queries/services/types";

describe("resolveHealthNavigationTarget", () => {
  it("maps a templateCategory jumpTo to the templates tab plus the exact category", () => {
    expect(resolveHealthNavigationTarget({ kind: "templateCategory", category: "budgetLines" })).toEqual({ tab: "templates", category: "budgetLines" });
  });

  it("maps a draftVersionForm jumpTo to the overview tab with no category", () => {
    expect(resolveHealthNavigationTarget({ kind: "draftVersionForm" })).toEqual({ tab: "overview" });
  });
});

describe("HEALTH_CATEGORY_DEFINITIONS", () => {
  it("covers exactly the 9 signals health.ts can push, each with a unique key and label", () => {
    expect(HEALTH_CATEGORY_DEFINITIONS).toHaveLength(9);
    expect(new Set(HEALTH_CATEGORY_DEFINITIONS.map((d) => d.key)).size).toBe(9);
    expect(new Set(HEALTH_CATEGORY_DEFINITIONS.map((d) => d.missingLabel)).size).toBe(9);
  });

  it("marks only basePrice as blocking — every other signal is a warning", () => {
    const blocking = HEALTH_CATEGORY_DEFINITIONS.filter((d) => d.severity === "blocking");
    expect(blocking.map((d) => d.key)).toEqual(["basePrice"]);
  });

  it("gives a RequirementCardVariant only to the 5 categories that have a matching icon", () => {
    const withVariant = HEALTH_CATEGORY_DEFINITIONS.filter((d) => d.requirementVariant).map((d) => d.key);
    expect(withVariant.sort()).toEqual(["budget", "inventory", "purchases", "teamRoles", "vendors"].sort());
  });
});

describe("deriveHealthCategoryStatuses", () => {
  it("marks every category complete when missing[] is empty", () => {
    const statuses = deriveHealthCategoryStatuses([]);
    expect(statuses).toHaveLength(9);
    expect(statuses.every((s) => !s.isMissing)).toBe(true);
  });

  it("marks exactly the categories whose label appears in missing[] as isMissing, leaving the rest complete", () => {
    const missing: ServiceHealthMissingItem[] = [
      { label: "Set a base price", jumpTo: { kind: "draftVersionForm" } },
      { label: "Budget", jumpTo: { kind: "templateCategory", category: "budgetLines" } },
    ];
    const statuses = deriveHealthCategoryStatuses(missing);
    const missingKeys = statuses.filter((s) => s.isMissing).map((s) => s.key);
    expect(missingKeys.sort()).toEqual(["basePrice", "budget"]);
  });

  it("treats the resource signal's three sub-labels independently, matching health.ts's own atomic 3-push behavior", () => {
    const missing: ServiceHealthMissingItem[] = [
      { label: "Vendor", jumpTo: { kind: "templateCategory", category: "vendorSuggestions" } },
      { label: "Inventory", jumpTo: { kind: "templateCategory", category: "inventoryItems" } },
      { label: "Purchase", jumpTo: { kind: "templateCategory", category: "purchaseItems" } },
    ];
    const statuses = deriveHealthCategoryStatuses(missing);
    expect(statuses.find((s) => s.key === "vendors")?.isMissing).toBe(true);
    expect(statuses.find((s) => s.key === "inventory")?.isMissing).toBe(true);
    expect(statuses.find((s) => s.key === "purchases")?.isMissing).toBe(true);
    expect(statuses.find((s) => s.key === "budget")?.isMissing).toBe(false);
  });
});
