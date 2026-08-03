import { describe, expect, it } from "vitest";
import { ALL_TEMPLATE_CATEGORY_ADAPTERS, addOnAdapter, seasonalWindowAdapter, budgetLineAdapter } from "@/modules/services/templateCategoryAdapters";
import { TEMPLATE_CATEGORY_KEYS } from "@/lib/queries/services/types";

describe("ALL_TEMPLATE_CATEGORY_ADAPTERS", () => {
  it("has exactly one adapter per real template category key, matching the query layer's own list", () => {
    const adapterKeys = ALL_TEMPLATE_CATEGORY_ADAPTERS.map((adapter) => adapter.key).sort();
    expect(adapterKeys).toEqual([...TEMPLATE_CATEGORY_KEYS].sort());
  });

  it("marks every category reorderable except seasonalWindows, the one category with no display_order column", () => {
    for (const adapter of ALL_TEMPLATE_CATEGORY_ADAPTERS) {
      if (adapter.key === "seasonalWindows") {
        expect(adapter.supportsReorder).toBe(false);
      } else {
        expect(adapter.supportsReorder).toBe(true);
      }
    }
  });

  it("assigns a RequirementCard variant to exactly the 5 categories the icon vocabulary covers", () => {
    const withVariant = ALL_TEMPLATE_CATEGORY_ADAPTERS.filter((adapter) => adapter.requirementVariant).map((adapter) => adapter.key).sort();
    expect(withVariant).toEqual(["budgetLines", "inventoryItems", "purchaseItems", "teamRoleRequirements", "vendorSuggestions"].sort());
  });

  it("never includes display_order as an editable field descriptor — reordering is a separate concern from the Inspector form", () => {
    for (const adapter of ALL_TEMPLATE_CATEGORY_ADAPTERS) {
      expect(adapter.fields.some((field) => field.name === "display_order")).toBe(false);
    }
  });
});

describe("individual adapter row summaries", () => {
  it("addOnAdapter shows the price as row metadata", () => {
    const metadata = addOnAdapter.toRowMetadata?.({ id: "a1", label: "Extra hour", description: null, price_delta_minor: 15000, display_order: 0 } as never);
    expect(metadata).toEqual([{ label: "$150.00" }]);
  });

  it("seasonalWindowAdapter labels a row by its month range", () => {
    const label = seasonalWindowAdapter.toRowLabel({ id: "s1", start_month: 5, end_month: 9, note: null } as never);
    expect(label).toBe("May – September");
  });

  it("budgetLineAdapter shows both revenue and cost as row metadata", () => {
    const metadata = budgetLineAdapter.toRowMetadata?.({ id: "b1", label: "Staffing", category: null, estimated_revenue_minor: 100000, estimated_cost_minor: 40000, display_order: 0 } as never);
    expect(metadata).toEqual([{ label: "Rev $1,000.00" }, { label: "Cost $400.00" }]);
  });
});
