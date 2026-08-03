import { describe, expect, it } from "vitest";
import { deliverableCoverage, findIncompleteDeliverables, findRejectedDeliverables, findOrphanedDeliverables } from "@/core/operationalPlanning/deliverableEngine";
import type { Deliverable, DeliverableStatus } from "@/types/operationalPlanning";

function makeDeliverable(id: string, status: DeliverableStatus, producedByStepId: string | null = null): Deliverable {
  return { id, title: id, type: "physical", description: null, produced_by_step_id: producedByStepId, status, linked_node: null };
}

describe("deliverableCoverage", () => {
  it("is vacuous (ratio 1) for zero deliverables", () => {
    expect(deliverableCoverage([])).toEqual({ total: 0, delivered: 0, ratio: 1 });
  });

  it("computes delivered/total ratio", () => {
    const deliverables = [makeDeliverable("d1", "delivered"), makeDeliverable("d2", "pending")];
    expect(deliverableCoverage(deliverables)).toEqual({ total: 2, delivered: 1, ratio: 0.5 });
  });
});

describe("findIncompleteDeliverables / findRejectedDeliverables", () => {
  it("filters correctly", () => {
    const deliverables = [makeDeliverable("d1", "delivered"), makeDeliverable("d2", "rejected"), makeDeliverable("d3", "ready")];
    expect(findIncompleteDeliverables(deliverables).map((d) => d.id)).toEqual(["d2", "d3"]);
    expect(findRejectedDeliverables(deliverables).map((d) => d.id)).toEqual(["d2"]);
  });
});

describe("findOrphanedDeliverables", () => {
  it("flags a deliverable produced by a step that doesn't exist", () => {
    const deliverables = [makeDeliverable("d1", "pending", "step_missing"), makeDeliverable("d2", "pending", "step_1")];
    const orphaned = findOrphanedDeliverables(deliverables, new Set(["step_1"]));
    expect(orphaned.map((d) => d.id)).toEqual(["d1"]);
  });
});
