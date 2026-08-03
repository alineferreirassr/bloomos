import { describe, expect, it } from "vitest";
import { checklistCompletionRatio, isChecklistComplete, findIncompleteChecklists } from "@/core/operationalPlanning/checklistEngine";
import type { PlanChecklist } from "@/types/operationalPlanning";

function makeChecklist(id: string, items: Array<{ completed: boolean }>): PlanChecklist {
  return { id, template_id: null, name: id, kind: "task", items: items.map((i, idx) => ({ id: `${id}_item_${idx}`, label: `Item ${idx}`, completed: i.completed })) };
}

describe("checklistCompletionRatio", () => {
  it("is vacuous (ratio 1) for zero items", () => {
    expect(checklistCompletionRatio(makeChecklist("c1", []))).toBe(1);
  });

  it("computes the completed ratio", () => {
    expect(checklistCompletionRatio(makeChecklist("c1", [{ completed: true }, { completed: false }]))).toBe(0.5);
  });
});

describe("isChecklistComplete / findIncompleteChecklists", () => {
  it("distinguishes complete from incomplete checklists", () => {
    const complete = makeChecklist("c1", [{ completed: true }]);
    const incomplete = makeChecklist("c2", [{ completed: true }, { completed: false }]);
    expect(isChecklistComplete(complete)).toBe(true);
    expect(isChecklistComplete(incomplete)).toBe(false);
    expect(findIncompleteChecklists([complete, incomplete]).map((c) => c.id)).toEqual(["c2"]);
  });
});
