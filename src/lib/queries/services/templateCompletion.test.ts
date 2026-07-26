import { describe, expect, it } from "vitest";
import { computeTemplateCompletion } from "@/lib/queries/services/templateCompletion";
import type { TemplateBuilderData } from "@/lib/queries/services/types";

function builder(groups: TemplateBuilderData["groups"]): TemplateBuilderData {
  return { serviceVersionId: "draft_1", isEditable: true, groups };
}

describe("computeTemplateCompletion", () => {
  it("is 100% when every expected category has at least one item", () => {
    const data = builder([
      { groupName: "A", categories: [{ key: "checklistItems", rows: [{ id: "1" }], count: 1, expectation: "expected" }] },
      { groupName: "B", categories: [{ key: "includedItems", rows: [], count: 0, expectation: "optional" }] },
    ]);
    const result = computeTemplateCompletion(data);
    expect(result.percent).toBe(100);
    expect(result.requiredComplete).toBe(1);
    expect(result.requiredTotal).toBe(1);
    expect(result.optionalUsed).toBe(0);
    expect(result.optionalTotal).toBe(1);
    expect(result.missingRequiredCategories).toEqual([]);
  });

  it("computes a partial percent and names the missing expected categories with human labels", () => {
    const data = builder([
      {
        groupName: "A",
        categories: [
          { key: "checklistItems", rows: [{ id: "1" }], count: 1, expectation: "expected" },
          { key: "budgetLines", rows: [], count: 0, expectation: "expected" },
        ],
      },
    ]);
    const result = computeTemplateCompletion(data);
    expect(result.percent).toBe(50);
    expect(result.missingRequiredCategories).toEqual(["Budget"]);
  });

  it("defaults to 100% when there are no expected categories at all", () => {
    const data = builder([{ groupName: "A", categories: [{ key: "includedItems", rows: [], count: 0, expectation: "optional" }] }]);
    const result = computeTemplateCompletion(data);
    expect(result.percent).toBe(100);
    expect(result.requiredTotal).toBe(0);
  });

  it("counts optional categories with items as used, independent of the expected ratio", () => {
    const data = builder([
      {
        groupName: "A",
        categories: [
          { key: "checklistItems", rows: [], count: 0, expectation: "expected" },
          { key: "includedItems", rows: [{ id: "1" }], count: 1, expectation: "optional" },
          { key: "addOns", rows: [], count: 0, expectation: "optional" },
        ],
      },
    ]);
    const result = computeTemplateCompletion(data);
    expect(result.optionalUsed).toBe(1);
    expect(result.optionalTotal).toBe(2);
  });
});
