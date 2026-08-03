import { describe, expect, it } from "vitest";
import { computeSearchHealth } from "@/core/search/searchHealthEngine";
import { registerSearchableEntity } from "@/core/search/registry";
import { setActiveSearchProvider } from "@/core/search/service";
import { workspaceSearchProvider } from "@/core/workspace/workspaceSearchProvider";
import { ENTITY_TYPES } from "@/core/enums/entityType";

describe("computeSearchHealth", () => {
  it("always includes exactly the coverage, index, and performance categories", () => {
    const report = computeSearchHealth("2026-06-01T00:00:00.000Z");
    expect(report.categories.map((c) => c.category)).toEqual(["coverage", "index", "performance"]);
  });

  it("reports performance as honestly not-applicable, never fabricated", () => {
    const report = computeSearchHealth("2026-06-01T00:00:00.000Z");
    const performance = report.categories.find((c) => c.category === "performance");
    expect(performance?.score).toBeNull();
    expect(performance?.notApplicableReason).toBeTruthy();
  });

  it("scores index 0 with no real provider registered, and 100 once one is", () => {
    const before = computeSearchHealth("2026-06-01T00:00:00.000Z");
    expect(before.categories.find((c) => c.category === "index")?.score).toBe(0);

    setActiveSearchProvider(workspaceSearchProvider);
    const after = computeSearchHealth("2026-06-01T00:00:00.000Z");
    expect(after.categories.find((c) => c.category === "index")?.score).toBe(100);
  });

  it("recommends registering uncovered entity types when coverage is incomplete", () => {
    registerSearchableEntity({ entityType: "lead", label: "Lead", module: "CRM" });
    const report = computeSearchHealth("2026-06-01T00:00:00.000Z");
    expect(report.uncoveredEntityTypes.length).toBeGreaterThan(0);
    expect(report.recommendations.some((r) => r.includes("searchable"))).toBe(true);
  });

  it("scores coverage 100 once every entity type is registered as searchable", () => {
    for (const entityType of ENTITY_TYPES) {
      registerSearchableEntity({ entityType, label: entityType, module: "Test" });
    }
    const report = computeSearchHealth("2026-06-01T00:00:00.000Z");
    const coverage = report.categories.find((c) => c.category === "coverage");
    expect(coverage?.score).toBe(100);
    expect(coverage?.issues).toEqual([]);
    expect(report.uncoveredEntityTypes).toEqual([]);
  });
});
